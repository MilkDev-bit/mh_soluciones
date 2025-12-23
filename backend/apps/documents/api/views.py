import logging

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework import status
from google.auth.exceptions import RefreshError
from googleapiclient.errors import HttpError

from apps.core.permissions import ADMIN_ROLES
from apps.core.utils import (
    success_response, error_response, created_response,
    validation_error_response
)
from apps.projects.models import ProjectMember
from ..models import Document
from ..tasks import upload_document_to_drive
from ..services import GoogleDriveService
from .permissions import IsOwnerOrAdminReadOnly
from .serializers import DocumentSerializer

logger = logging.getLogger(__name__)


class DocumentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los documentos.
    """
    serializer_class = DocumentSerializer
    permission_classes = [IsOwnerOrAdminReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        """
        Filtra los documentos. Si se provee un 'task_id' en la URL,
        filtra por esa tarea. De lo contrario, devuelve los documentos
        según los permisos del usuario.
        """
        user = self.request.user
        queryset = Document.objects.all()

        if not user.is_anonymous and user.role not in ADMIN_ROLES:
            user_projects = user.projects.all()
            queryset = queryset.filter(
                Q(project__in=user_projects) | 
                Q(task__project__in=user_projects) |
                Q(uploaded_by=user)
            ).distinct()
        
        # Filter by specific project
        project_id = self.request.query_params.get('project')
        if project_id:
            try:
                queryset = queryset.filter(project_id=int(project_id))
            except (ValueError, TypeError):
                queryset = queryset.none()
        
        # Filter by folder_type
        folder_type = self.request.query_params.get('folder_type')
        if folder_type:
            queryset = queryset.filter(folder_type=folder_type)
        
        task_id = self.request.query_params.get('task')
        if task_id:
            try:
                return queryset.filter(task_id=int(task_id))
            except (ValueError, TypeError):
                return queryset.none()
        
        return queryset

    def perform_create(self, serializer):
        """
        Asigna el usuario actual al crear un documento, asegura la relación
        con el proyecto y encola la tarea de subida a Google Drive.
        Valida que el usuario pertenezca al proyecto antes de permitir la subida.
        """
        user = self.request.user
        project_id = self.request.data.get('project')
        
        # Validate project membership if project is specified
        if project_id:
            is_admin = user.role in ADMIN_ROLES
            is_member = ProjectMember.objects.filter(
                project_id=project_id,
                user=user
            ).exists()
            
            if not is_admin and not is_member:
                raise ValidationError({
                    'project': 'No tienes permisos para subir archivos a este proyecto'
                })
        
        document = serializer.save(uploaded_by=user)
        
        if document.task and document.task.project:
            document.project = document.task.project
            document.save(update_fields=['project']) 
        try:
            upload_document_to_drive.delay(document.id)
            logger.info(f"Tarea para subir el documento {document.id} a Google Drive ha sido encolada.")
        except Exception as e:
            logger.error(f"Error al encolar la tarea de subida a Drive: {e}")
            document.upload_status = Document.UploadStatus.FAILED
            document.save(update_fields=['upload_status'])

    @action(detail=False, methods=['get'], url_path='folders')
    def list_folders(self, request):
        """
        Lista las carpetas reales de Google Drive para un proyecto específico.
        Requiere parámetro 'project' en query params.
        
        Control de acceso por rol:
        - SUPERADMIN, CEO, ADMIN: pueden ver carpetas de cualquier proyecto
        - Otros roles: solo pueden ver carpetas de proyectos donde son miembros
        """
        project_id = request.query_params.get('project')
        user = request.user
        
        if not project_id:
            return Response(
                {'error': 'El parámetro "project" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Validate project exists
            from apps.projects.models import Project
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
            
            # Get folders for the project
            logger.info(f"[ACCESS] Usuario {user.username} consultando carpetas de Drive para proyecto ID={project_id}")
            folders = drive_service.list_folders_for_project(project_id)
            
            # Format response
            folder_list = [
                {
                    'id': folder.get('id'),
                    'name': folder.get('name'),
                    'createdTime': folder.get('createdTime'),
                    'modifiedTime': folder.get('modifiedTime'),
                    'isProjectRoot': folder.get('isProjectRoot', False)
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