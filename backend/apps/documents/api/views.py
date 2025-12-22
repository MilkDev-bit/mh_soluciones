import logging

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework import status

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
        """
        project_id = request.query_params.get('project')
        
        if not project_id:
            return Response(
                {'error': 'El parámetro "project" es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Initialize Drive service with institutional credentials
            drive_service = GoogleDriveService(use_institutional=True)
            
            # Get folders for the project
            folders = drive_service.list_folders_for_project(project_id)
            
            # Format response
            folder_list = [
                {
                    'id': folder.get('id'),
                    'name': folder.get('name'),
                    'createdTime': folder.get('createdTime'),
                    'modifiedTime': folder.get('modifiedTime')
                }
                for folder in folders
            ]
            
            return Response(folder_list, status=status.HTTP_200_OK)
            
        except ValueError as e:
            logger.error(f"Error de configuración: {e}")
            return Response(
                {'error': 'Configuración de Google Drive no disponible'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            logger.error(f"Error al listar carpetas: {e}")
            return Response(
                {'error': 'Error al obtener carpetas de Google Drive'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )