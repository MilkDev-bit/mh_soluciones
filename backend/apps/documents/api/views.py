import logging
import threading

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import APIException, ValidationError
from rest_framework.response import Response
from rest_framework import status
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError

from apps.core.permissions import ADMIN_ROLES
from apps.core.utils import (
    success_response, error_response, created_response,
    validation_error_response
)
from apps.projects.models import Project, ProjectMember
from ..models import Document
from ..tasks import upload_document_to_drive
from ..services import GoogleDriveService, is_valid_drive_id
from .permissions import IsOwnerOrAdminReadOnly
from .serializers import DocumentSerializer
from .. import browser

logger = logging.getLogger(__name__)


_CELERY_CHECK = {'value': None, 'checked_at': 0.0}
_CELERY_CHECK_TTL = 60  # segundos


def _is_celery_worker_available():
    """
    Verifica si hay al menos un Celery worker activo consultando Redis.
    Retorna False si no hay workers o si hay cualquier error.

    [FIX] Importaba `config.celery_app`, que no existe: siempre devolvía False y
    TODAS las subidas a Drive se hacían en un hilo del servidor web aunque
    hubiera worker de Celery.
    [RENDIMIENTO] Cada consulta esperaba hasta 0.5 s y se hacía POR ARCHIVO
    (5 archivos = 2.5 s extra por entrega). Ahora el resultado se guarda 60 s.
    """
    import time
    now = time.monotonic()
    if _CELERY_CHECK['value'] is not None and now - _CELERY_CHECK['checked_at'] < _CELERY_CHECK_TTL:
        return _CELERY_CHECK['value']
    try:
        from config.celery import app as celery_app
        inspector = celery_app.control.inspect(timeout=0.5)
        available = bool(inspector.ping())
    except Exception:
        available = False
    _CELERY_CHECK.update(value=available, checked_at=now)
    return available


def _run_upload_sync(document, target_folder_id=None):
    """
    Ejecuta la subida a Google Drive en un hilo de fondo para no bloquear
    el worker de gunicorn (evita timeouts de Railway en uploads síncronos).
    """
    doc_id = document.id

    def _do_upload():
        from apps.documents.tasks import upload_document_to_drive as _upload_task
        try:
            _upload_task(doc_id, target_folder_id=target_folder_id)
            logger.info(f"✅ Subida síncrona (hilo) exitosa para documento ID={doc_id}")
        except Exception as e:
            logger.error(f"❌ Error en subida síncrona (hilo) para doc {doc_id}: {e}")
            try:
                from apps.documents.models import Document as Doc
                Doc.objects.filter(pk=doc_id).update(upload_status=Doc.UploadStatus.FAILED)
            except Exception:
                pass

    t = threading.Thread(target=_do_upload, daemon=True)
    t.start()
    logger.info(f"🧵 Hilo de subida iniciado para documento ID={doc_id}")

class ServiceUnavailable(APIException):
    status_code = 503
    default_detail = 'Servicio no disponible temporalmente.'
    default_code = 'service_unavailable'


def _user_can_upload_to_project(user, project):
    """Admins, miembros del proyecto o asignados a alguna tarea del proyecto."""
    if user.role in ADMIN_ROLES:
        return True
    if ProjectMember.objects.filter(project=project, user=user).exists():
        return True
    from apps.tasks.models import Task as TaskModel
    return TaskModel.objects.filter(project=project).filter(
        Q(assigned_to=user) | Q(assigned_students=user)
    ).exists()


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los documentos.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsOwnerOrAdminReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def _base_queryset(self):
        """Documentos que el usuario puede ver (sin filtros del explorador)."""
        user = self.request.user
        queryset = Document.objects.select_related(
            'task', 'task__project', 'project', 'uploaded_by', 'task_submission'
        ).all()

        if not user.is_anonymous and user.role not in ADMIN_ROLES:
            if user.role == 'CLIENT':
                # Clients see documents from projects where they are the client FK or a member
                member_project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
                queryset = queryset.filter(
                    Q(project__client=user) |
                    Q(task__project__client=user) |
                    Q(project_id__in=member_project_ids) |
                    Q(task__project_id__in=member_project_ids)
                ).distinct()
            else:
                user_projects = user.projects.all()
                queryset = queryset.filter(
                    Q(project__in=user_projects) | 
                    Q(task__project__in=user_projects) |
                    Q(uploaded_by=user)
                ).distinct()
                if user.role == 'STUDENT':
                    # [FIX privacidad] Un alumno no ve los archivos que sus
                    # compañeros entregaron en sus tareas (igual que en Tareas).
                    queryset = queryset.filter(
                        Q(task_submission__isnull=True)
                        | Q(task_submission__submitted_by=user)
                        | Q(uploaded_by=user)
                    )
        return queryset

    def get_queryset(self):
        """
        Filtra los documentos. Si se provee un 'task_id' en la URL,
        filtra por esa tarea. De lo contrario, devuelve los documentos
        según los permisos del usuario.

        Filtros del explorador (todos en servidor, ver documents/browser.py):
        project, folder, uploaded_by, search, folder_type, date_from, date_to.
        """
        params = self.request.query_params
        queryset = browser.apply_filters(self._base_queryset(), params)
        
        # Filter by Drive folder ID (matches drive_parent_folder_id on the document)
        drive_folder_id = params.get('drive_folder_id')
        if drive_folder_id:
            queryset = queryset.filter(drive_parent_folder_id=drive_folder_id)

        # Filter by folder name (case-insensitive, matches drive_parent_folder_name OR task title)
        folder_name = params.get('folder_name')
        if folder_name:
            queryset = queryset.filter(
                Q(drive_parent_folder_name__icontains=folder_name) |
                Q(task__title__icontains=folder_name)
            )
        
        task_id = params.get('task')
        if task_id:
            try:
                return queryset.filter(task_id=int(task_id))
            except (ValueError, TypeError):
                return queryset.none()
        
        return queryset.order_by('-created_at')

    @action(detail=False, methods=['get'], url_path='folder-summary')
    def folder_summary(self, request):
        """
        Carpetas del nivel actual con número de archivos, tamaño y última
        subida. Se calcula en la base de datos: no consulta Google Drive.
        """
        return Response(browser.folder_summary(self._base_queryset(), request.query_params))

    @action(detail=False, methods=['get'], url_path='download-zip')
    def download_zip(self, request):
        """
        Descarga como ZIP todo lo que coincide con los filtros actuales
        (proyecto, carpeta, persona, búsqueda, tipo, fechas), organizado en
        carpetas Carpeta/Persona/archivo. Se envía en streaming: no se arma en
        memoria y el navegador empieza a descargar de inmediato.
        """
        from asgiref.sync import sync_to_async
        from django.http import StreamingHttpResponse

        if request.user.role == 'CLIENT' and not request.query_params.get('project'):
            return Response({'error': 'Selecciona un proyecto para descargar.'},
                            status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset()
        docs = browser.zip_document_rows(queryset)
        if not docs:
            return Response({'error': 'No hay archivos para descargar con estos filtros.'},
                            status=status.HTTP_404_NOT_FOUND)
        if len(docs) > browser.MAX_ZIP_FILES:
            return Response({
                'error': f'La descarga tiene más de {browser.MAX_ZIP_FILES} archivos. '
                         'Entra a una carpeta o filtra por fechas para dividirla.'
            }, status=status.HTTP_400_BAD_REQUEST)

        entries = browser.zip_entries(docs, request.query_params)
        sync_iter = browser.iter_zip(entries)
        sentinel = object()

        async def stream():
            # En ASGI, Django guarda en memoria un iterador síncrono completo
            # antes de enviarlo; este iterador asíncrono envía cada parte
            # apenas está lista.
            while True:
                chunk = await sync_to_async(next, thread_sensitive=False)(sync_iter, sentinel)
                if chunk is sentinel:
                    break
                yield chunk

        filename = browser.safe_name(request.query_params.get('zip_name') or 'archivos', 'archivos')
        response = StreamingHttpResponse(stream(), content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{filename}.zip"'
        response['X-Accel-Buffering'] = 'no'  # que nginx no acumule el ZIP completo
        logger.info("ZIP de %s archivos solicitado por %s", len(entries), request.user.username)
        return response

    def perform_create(self, serializer):
        """
        Asigna el usuario actual al crear un documento, asegura la relación
        con el proyecto y encola la tarea de subida a Google Drive.
        Valida que el usuario pertenezca al proyecto antes de permitir la subida.
        """
        user = self.request.user
        data = serializer.validated_data
        project = data.get('project')
        task = data.get('task')
        target_folder_id = (data.get('target_folder_id') or '').strip() or None

        # Clients cannot upload documents
        if user.role == 'CLIENT':
            raise ValidationError({
                'detail': 'Los clientes no tienen permisos para subir archivos.'
            })

        # SEGURIDAD: la tarea y el proyecto deben coincidir. Antes se validaba
        # solo `project` y después se reemplazaba por `task.project`, así que
        # bastaba con enviar un proyecto propio y una tarea ajena para subir
        # archivos a un proyecto sin acceso.
        if task and project and task.project_id != project.id:
            raise ValidationError({'task': 'La tarea no pertenece al proyecto indicado.'})
        effective_project = task.project if task and task.project_id else project

        if effective_project and not _user_can_upload_to_project(user, effective_project):
            raise ValidationError({
                'project': 'No tienes permisos para subir archivos a este proyecto'
            })

        # SEGURIDAD: la carpeta destino viene del cliente; se verifica en Drive
        # que sea la carpeta del proyecto o una subcarpeta suya. Sin esto se
        # podía escribir en cualquier carpeta visible para la cuenta de servicio.
        if target_folder_id:
            if not effective_project:
                raise ValidationError({'target_folder_id': 'Indica el proyecto de la carpeta destino.'})
            if not is_valid_drive_id(target_folder_id):
                raise ValidationError({'target_folder_id': 'ID de carpeta inválido.'})
            try:
                belongs = GoogleDriveService(use_institutional=True).folder_belongs_to_project(
                    target_folder_id, effective_project
                )
            except HttpError as e:
                status_code = getattr(getattr(e, 'resp', None), 'status', None)
                if status_code in (403, 404):
                    belongs = False
                else:
                    logger.error("[UPLOAD] No se pudo verificar la carpeta %s: %s", target_folder_id, e)
                    raise ServiceUnavailable('No se pudo verificar la carpeta destino en Google Drive.')
            except Exception as e:
                logger.error("[UPLOAD] No se pudo verificar la carpeta %s: %s", target_folder_id, e)
                raise ServiceUnavailable('No se pudo verificar la carpeta destino en Google Drive.')
            if not belongs:
                logger.warning(
                    "[UPLOAD] %s intentó subir a la carpeta %s fuera del proyecto ID=%s",
                    user.username, target_folder_id, effective_project.id,
                )
                raise ValidationError({'target_folder_id': 'La carpeta destino no pertenece a este proyecto.'})

        project_id = effective_project.id if effective_project else None
        logger.info(
            f"[UPLOAD] Usuario {user.username} (rol: {user.role}) subiendo a "
            f"folder_id={target_folder_id or 'auto'} en proyecto ID={project_id}"
        )

        # Save the document (target_folder_id is write_only and won't be saved to DB)
        document = serializer.save(uploaded_by=user)
        
        if document.task and document.task.project:
            document.project = document.task.project
            document.save(update_fields=['project'])
        
        # Log upload details for audit/traceability
        logger.info(
            f"[UPLOAD] Documento ID={document.id} '{document.name}' creado por {user.username} "
            f"para proyecto ID={project_id}, carpeta destino ID={target_folder_id or 'auto-generada'}"
        )
        
        # Intentar subida asíncrona con Celery; si no hay worker activo, ejecutar síncronamente
        celery_worker_available = _is_celery_worker_available()
        if celery_worker_available:
            try:
                upload_document_to_drive.delay(document.id, target_folder_id=target_folder_id)
                logger.info(f"📤 Tarea Drive encolada para documento ID={document.id}")
            except Exception as e:
                logger.warning(f"⚠️ Error al encolar tarea Celery para doc {document.id}: {e}. Ejecutando síncronamente...")
                _run_upload_sync(document, target_folder_id)
        else:
            logger.info(f"⚡ Sin worker Celery disponible, subida síncrona para documento ID={document.id}")
            _run_upload_sync(document, target_folder_id)

    @action(detail=False, methods=['get'], url_path='folders')
    def list_folders(self, request):
        """
        Lista las carpetas de Google Drive para un proyecto específico (1 nivel).
        Parámetros:
          - project (requerido): ID del proyecto
          - parent_folder_id (opcional): ID de carpeta de Drive; si se provee,
            lista los hijos directos de esa carpeta en vez de la raíz del proyecto.
        """
        project_id = request.query_params.get('project')
        parent_folder_id = request.query_params.get('parent_folder_id')
        user = request.user

        if not project_id:
            return Response(
                {'error': 'El parámetro "project" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Validate project exists
            try:
                project = Project.objects.get(id=project_id)
            except Project.DoesNotExist:
                logger.warning(f"Usuario {user.username} intentó acceder a proyecto inexistente ID={project_id}")
                return Response(
                    {'error': f'El proyecto con ID {project_id} no existe'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check access permissions based on role
            has_access = False
            
            # SUPERADMIN, CEO, ADMIN have access to all projects
            if user.role in ADMIN_ROLES:
                has_access = True
                logger.info(f"[ACCESS] Usuario {user.username} (rol: {user.role}) tiene acceso total - puede ver proyecto ID={project_id}")
            else:
                # Other roles: check if user is a member of the project
                is_member = ProjectMember.objects.filter(
                    project_id=project_id,
                    user=user
                ).exists()
                
                if is_member:
                    has_access = True
                    logger.info(f"[ACCESS] Usuario {user.username} (rol: {user.role}) es miembro del proyecto ID={project_id}")
                else:
                    logger.warning(
                        f"[ACCESS] Usuario {user.username} (rol: {user.role}) NO tiene acceso al proyecto ID={project_id} - "
                        f"no es miembro y no tiene rol de administrador"
                    )
            
            if not has_access:
                return Response(
                    {
                        'error': 'No tiene permisos para ver estas carpetas.',
                        'detail': 'No tiene acceso a este proyecto. Solo puede ver carpetas de proyectos en los que es miembro.'
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Initialize Drive service with institutional credentials
            drive_service = GoogleDriveService(use_institutional=True)

            # Si se provee parent_folder_id, listar hijos de esa carpeta directamente
            if parent_folder_id:
                # SEGURIDAD: solo se navega dentro de la carpeta del proyecto;
                # antes cualquier ID de Drive devolvía sus subcarpetas.
                if not drive_service.folder_belongs_to_project(parent_folder_id, project):
                    logger.warning(
                        f"[ACCESS] {user.username} pidió la carpeta {parent_folder_id} fuera del proyecto ID={project_id}"
                    )
                    return Response(
                        {'error': 'La carpeta no pertenece a este proyecto.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                logger.info(f"[ACCESS] Usuario {user.username} consultando hijos de carpeta Drive ID={parent_folder_id}")
                folders = drive_service.list_direct_subfolders(parent_folder_id)
            else:
                logger.info(f"[ACCESS] Usuario {user.username} consultando carpetas de Drive para proyecto ID={project_id}")
                folders = drive_service.list_folders_for_project(project_id)
            
            # Format response (incluye parentId para navegar la jerarquía en el frontend)
            folder_list = [
                {
                    'id': folder.get('id'),
                    'name': folder.get('name'),
                    'createdTime': folder.get('createdTime'),
                    'modifiedTime': folder.get('modifiedTime'),
                    'isProjectRoot': folder.get('isProjectRoot', False),
                    'parentId': folder.get('parentId'),
                }
                for folder in folders
            ]
            
            logger.info(f"[ACCESS] Retornando {len(folder_list)} carpetas para proyecto ID={project_id} al usuario {user.username}")
            
            return Response(folder_list, status=status.HTTP_200_OK)
            
        except RefreshError as e:
            logger.error(
                f"Error al refrescar credenciales de Google Drive para project_id={project_id}: {e}"
            )
            return Response(
                {
                    'detail': 'Credenciales institucionales de Google Drive expiradas o inválidas. '
                             'Por favor, reautentique la cuenta de Google en la administración.',
                    'error_type': 'refresh_error'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except HttpError as e:
            error_code = e.resp.status
            logger.error(
                f"Error HTTP al acceder a Google Drive para project_id={project_id}: "
                f"código={error_code}, mensaje={e}"
            )
            
            if error_code in (401, 403):
                return Response(
                    {
                        'detail': 'Sin permisos para acceder a la carpeta de Google Drive del proyecto. '
                                 'Verifique que las credenciales institucionales tengan los permisos correctos.',
                        'error_type': 'permission_error',
                        'status_code': error_code
                    },
                    status=status.HTTP_403_FORBIDDEN
                )
            else:
                return Response(
                    {
                        'detail': f'Error al acceder a Google Drive (código {error_code}). '
                                 'Por favor, contacte a soporte técnico.',
                        'error_type': 'google_api_error',
                        'status_code': error_code
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except ValueError as e:
            logger.error(f"Error de configuración al acceder a Google Drive: {e}")
            return Response(
                {
                    'detail': 'Configuración de Google Drive no disponible. '
                             'Verifique que GOOGLE_DRIVE_ADMIN_USER_ID esté configurado correctamente.',
                    'error_type': 'configuration_error'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.exception(f"Error inesperado al listar carpetas para project_id={project_id}: {e}")
            return Response(
                {
                    'detail': 'Error inesperado al obtener carpetas de Google Drive. '
                             'Por favor, contacte a soporte técnico.',
                    'error_type': 'unknown_error'
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )