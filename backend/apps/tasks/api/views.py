from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from rest_framework.parsers import MultiPartParser, FormParser
from ..models import Task, TaskSubmission, TaskComment
from .serializers import (
    TaskSerializer,
    TaskDetailSerializer,
    TaskCreateUpdateSerializer,
    TaskSubmissionSerializer,
    TaskCommentSerializer
)
from .permissions import IsOwnerOrAdmin, CanInteractWithTask
from apps.documents.services import GoogleDriveService
from django.conf import settings
from django.utils.text import slugify

class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Tareas.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_queryset = Task.objects.none()

        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            base_queryset = Task.objects.all().select_related('project', 'assigned_to')
        else:
            base_queryset = Task.objects.filter(
                Q(project__members=user) |
                Q(assigned_to=user) |
                Q(created_by=user)
            ).distinct().select_related('project', 'assigned_to')

        project_id = self.request.query_params.get('project', None)
        if project_id:
            return base_queryset.filter(project_id=project_id)

        return base_queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        if self.action == 'retrieve':
            return TaskDetailSerializer
        return TaskSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            raise PermissionDenied("No tienes permisos para crear tareas.")
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR', 'DIRECTOR']:
            raise PermissionDenied("No tienes permisos para editar tareas.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            raise PermissionDenied("No tienes permisos para eliminar tareas.")
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

class TaskCommentViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los comentarios anidados de las tareas.
    """
    serializer_class = TaskCommentSerializer
    
    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [IsOwnerOrAdmin]
        else:
            self.permission_classes = [CanInteractWithTask]
        return super().get_permissions()

    def get_queryset(self):
        return TaskComment.objects.filter(task_id=self.kwargs['task_pk']).select_related('user')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, task_id=self.kwargs['task_pk'])

class TaskSubmissionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las entregas anidadas de las tareas.
    """
    serializer_class = TaskSubmissionSerializer
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [CanInteractWithTask]

    def get_queryset(self):
        return TaskSubmission.objects.filter(task_id=self.kwargs['task_pk']).select_related('submitted_by')

    def perform_create(self, serializer):
        task_submission = serializer.save(
            submitted_by=self.request.user, 
            task_id=self.kwargs['task_pk']
        )
        
        if task_submission.file:
            self._upload_to_google_drive(task_submission)

    def _upload_to_google_drive(self, task_submission):
        """
        Sube el archivo adjunto a Google Drive usando la estructura de upload_document
        """
        try:
            user = task_submission.submitted_by
            task = task_submission.task
            
            print(f"🚀 Iniciando subida a Google Drive para entrega de tarea: {task.title}")
            
            drive_service = GoogleDriveService(user)
            
            file_content = task_submission.file.read()
            original_filename = task_submission.file.name
            
            new_filename = self._create_structured_filename(task_submission, original_filename)
            
            folder_id = self._get_destination_folder(drive_service, task, user)
            
            mime_type = self._get_mime_type(original_filename)
            
            print(f"📤 Subiendo archivo: {new_filename} a carpeta ID: {folder_id}")
            
            drive_result = drive_service.upload_file(
                file_name=new_filename,
                file_content=file_content,
                folder_id=folder_id,
                mime_type=mime_type
            )
            
            if drive_result:
                task_submission.google_drive_file_id = drive_result['id']
                task_submission.google_drive_link = drive_result['webViewLink']
                task_submission.uploaded_to_drive = True
                task_submission.save()
                
                print(f"✅ Archivo subido exitosamente a Google Drive")
                print(f"📄 Nombre: {drive_result['name']}")
                print(f"🆔 ID: {drive_result['id']}")
                print(f"🔗 Enlace: {drive_result['webViewLink']}")
            else:
                print("⚠️ Archivo guardado localmente pero no se pudo subir a Google Drive")
                
        except Exception as e:
            print(f"❌ Error al subir a Google Drive: {e}")
            import traceback
            traceback.print_exc()

    def _create_structured_filename(self, task_submission, original_filename):
        """
        Crea un nombre de archivo estructurado similar al de upload_document
        """
        task = task_submission.task
        user = task_submission.submitted_by
        
        task_title = slugify(task.title)
        responsible_name = slugify(user.get_full_name() or user.username)
        date_str = task_submission.created_at.strftime('%d-%m-%y')
        
        import os
        filename, extension = os.path.splitext(original_filename)
        
        new_filename = f"entrega_{task_title}_{responsible_name}_{date_str}{extension}"
        
        return new_filename

    def _get_destination_folder(self, drive_service, task, user):
        """
        Define la carpeta destino en Google Drive usando estructura similar a upload_document
        """
        try:
            date = task.created_at
            current_year = date.strftime('%Y')
            
            if task.project:
                active_statuses = ['PLANNING', 'IN_PROGRESS']
                project_status_folder = "Proyectos Activos" if task.project.status in active_statuses else "Proyectos Inactivos"
                project_name = slugify(task.project.name)
                
                print(f"📁 Creando estructura de carpetas para proyecto: {task.project.name}")

                year1_id = drive_service._get_or_create_folder(current_year, parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)
                status_id = drive_service._get_or_create_folder(project_status_folder, parent_id=year1_id)
                project_id = drive_service._get_or_create_folder(project_name, parent_id=status_id)
                year2_id = drive_service._get_or_create_folder(current_year, parent_id=project_id)
                final_folder_id = drive_service._get_or_create_folder("Entregas de Tareas", parent_id=year2_id)
                
                return final_folder_id
            else:
                year_id = drive_service._get_or_create_folder(current_year, parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)
                final_folder_id = drive_service._get_or_create_folder("Entregas de Tareas", parent_id=year_id)
                
                return final_folder_id
                
        except Exception as e:
            print(f"❌ Error al crear estructura de carpetas: {e}")
            return "1soAtacPEeRySDgcN6760zMP_WYuGGsio"

    def _get_mime_type(self, filename):
        """
        Determina el MIME type basado en la extensión del archivo
        """
        import mimetypes
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or 'application/octet-stream'