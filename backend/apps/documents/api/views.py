import logging

from django.db.models import Q
from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser

from ..models import Document
from ..tasks import upload_document_to_drive
from .permissions import IsOwnerOrAdminReadOnly
from .serializers import DocumentSerializer

logger = logging.getLogger(__name__)

# Admin roles constant
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')


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
        """
        document = serializer.save(uploaded_by=self.request.user)
        
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