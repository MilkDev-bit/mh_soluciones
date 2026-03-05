import logging
import mimetypes
import os

from django.conf import settings
from django.db.models import Q, F, Avg
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import viewsets, permissions, status, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.decorators import action

from apps.core.permissions import (
    ADMIN_ROLES, TEACHER_ROLES, EDITOR_ROLES,
    IsTeacherRole, check_role_permission
)
from apps.core.utils import (
    success_response, error_response, created_response,
    updated_response, validation_error_response
)
from apps.documents.models import Document
from apps.documents.services import GoogleDriveService
from ..models import Task, TaskSubmission, TaskComment, TaskEditHistory, TaskReopenLog
from .serializers import (
    TaskSerializer,
    TaskDetailSerializer,
    TaskCreateUpdateSerializer,
    TaskSubmissionSerializer,
    TaskSubmissionGradeSerializer,
    TaskCommentSerializer,
    TaskReopenSerializer,
    TaskEditHistorySerializer
)
from .permissions import IsOwnerOrAdmin, CanInteractWithTask
from utils.email_notifications import (
    send_task_assignment_notification, 
    send_task_reopened_notification,
    send_task_returned_notification
)

logger = logging.getLogger(__name__)

# Task grading constants
PASSING_SCORE_THRESHOLD = 0.7  # 70% of max score is considered passing


class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Tareas.
    
    Permissions:
    - TEACHER_ROLES: Can create, update, delete tasks
    - STUDENT: Can view assigned tasks only (read-only)
    """
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if user.role in ADMIN_ROLES:
            base_queryset = Task.objects.all().select_related('project', 'assigned_to').prefetch_related('assigned_students')
        else:
            if user.role in TEACHER_ROLES:
                base_queryset = Task.objects.all().select_related('project', 'assigned_to').prefetch_related('assigned_students')
            else:
                # Students see only tasks assigned to them or their project tasks
                # Using multiple conditions to ensure tasks are visible:
                # 1. Student is a member of the project (through ProjectMember)
                # 2. Task is directly assigned to the student
                # 3. Student is in assigned_students field
                # 4. Student created the task
                base_queryset = Task.objects.filter(
                    Q(project__projectmember__user=user) |  # Student is member of project
                    Q(assigned_to=user) |                    # Task assigned to student
                    Q(assigned_students=user) |              # Student in assigned_students list
                    Q(created_by=user)                       # Student created the task
                ).exclude(status='DRAFT').distinct().select_related('project', 'assigned_to').prefetch_related('assigned_students')
                
                # Debug logging to help diagnose visibility issues
                logger.info(f"Student {user.username} (ID: {user.id}) queryset count: {base_queryset.count()}")

        project_id = getattr(self.request, 'query_params', self.request.GET).get('project', None)
        if project_id:
            filtered = base_queryset.filter(project_id=project_id)
            logger.info(f"Filtered by project {project_id}: {filtered.count()} tasks (user: {user.username})")
            return filtered

        return base_queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        if self.action == 'retrieve':
            return TaskDetailSerializer
        if self.action == 'reopen':
            return TaskReopenSerializer
        return TaskSerializer



    def perform_create(self, serializer):
        if self.request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para crear tareas.")
        
        # Get validated data to check for assigned users
        validated_data = serializer.validated_data
        has_assigned_to = validated_data.get('assigned_to') is not None
        has_assigned_students = 'assigned_students' in validated_data and validated_data.get('assigned_students')
        
        task = serializer.save(created_by=self.request.user)
        
        # Send email notification if task is assigned
        if has_assigned_to or has_assigned_students:
            send_task_assignment_notification(task)

    def perform_update(self, serializer):
        if self.request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para editar tareas.")
        
        instance = self.get_object()
        
        # Check if task has submissions - use count() for better performance
        submission_count = instance.submissions.count()
        if submission_count > 0:
            # Log the changes
            changes = {}
            for field in serializer.validated_data:
                old_value = getattr(instance, field)
                new_value = serializer.validated_data[field]
                if old_value != new_value:
                    changes[field] = {
                        'old': str(old_value),
                        'new': str(new_value)
                    }
            
            if changes:
                TaskEditHistory.objects.create(
                    task=instance,
                    edited_by=self.request.user,
                    changes=changes,
                    edit_reason=self.request.data.get('edit_reason', '')
                )
        
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ADMIN_ROLES:
            raise PermissionDenied("No tienes permisos para eliminar tareas.")
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=True, methods=['post'], url_path='reopen')
    def reopen(self, request, pk=None):
        """
        Reabrir una tarea cerrada.
        Solo TEACHER y ADMIN pueden reabrir tareas.
        """
        task = self.get_object()
        
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para reabrir tareas.")
        
        serializer = TaskReopenSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Update task status
        task.status = Task.TaskStatus.REOPENED
        task.close_date = serializer.validated_data['new_deadline']
        task.save()
        
        # Create reopen log
        reopen_log = TaskReopenLog.objects.create(
            task=task,
            reopened_by=request.user,
            new_deadline=serializer.validated_data['new_deadline'],
            reason=serializer.validated_data.get('reason', '')
        )
        
        # Add specific students if provided
        if 'specific_students' in serializer.validated_data:
            from apps.authentication.models import CustomUser
            students = CustomUser.objects.filter(
                id__in=serializer.validated_data['specific_students']
            )
            reopen_log.specific_students.set(students)
        
        # Send email notification
        send_task_reopened_notification(task, reopen_log)
        
        return Response({
            'message': 'Tarea reabierta exitosamente',
            'task': TaskDetailSerializer(task).data
        })
    
    @action(detail=False, methods=['get'], url_path='my-tasks')
    def my_tasks(self, request):
        """
        Obtener tareas del estudiante actual organizadas por estado.
        """
        user = request.user
        
        if user.role not in ['STUDENT', 'PROFESSOR']:
            return Response({
                'error': 'Este endpoint es solo para estudiantes'
            }, status=status.HTTP_403_FORBIDDEN)
        
        # Get all tasks assigned to this student
        tasks = Task.objects.filter(
            Q(assigned_students=user) | Q(assigned_to=user)
        ).exclude(status='DRAFT').distinct()
        
        # Categorize tasks
        now = timezone.now()
        to_submit = []
        submitted = []
        graded = []
        overdue = []
        
        for task in tasks:
            # Check if student has submitted
            submission = TaskSubmission.objects.filter(
                task=task,
                submitted_by=user
            ).order_by('-version').first()
            
            if submission:
                if submission.status == 'GRADED':
                    graded.append(task)
                else:
                    submitted.append(task)
            else:
                # Not submitted
                if task.close_date and task.close_date < now:
                    overdue.append(task)
                else:
                    to_submit.append(task)
        
        return Response({
            'to_submit': TaskSerializer(to_submit, many=True).data,
            'submitted': TaskSerializer(submitted, many=True).data,
            'graded': TaskSerializer(graded, many=True).data,
            'overdue': TaskSerializer(overdue, many=True).data
        })
    
    @action(detail=False, methods=['get'], url_path='completed')
    def completed_tasks(self, request):
        """Endpoint específico para tareas completadas con estadísticas"""
        queryset = self.get_queryset().filter(status='COMPLETED')
        
        project_id = request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='completed/stats')
    def completed_tasks_stats(self, request):
        """Endpoint para estadísticas de tareas completadas"""
        queryset = self.get_queryset().filter(status='COMPLETED')
        
        project_id = request.query_params.get('project')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        
        total = queryset.count()
        on_time = queryset.filter(completed_at__lte=F('due_date')).count()
        delayed = queryset.filter(completed_at__gt=F('due_date')).count()
        
        delayed_tasks = queryset.filter(completed_at__gt=F('due_date'))
        avg_delay = delayed_tasks.aggregate(
            avg_delay=Avg(F('completed_at') - F('due_date'))
        )['avg_delay']
        
        avg_delay_days = avg_delay.days if avg_delay else 0
        
        return Response({
            'total': total,
            'on_time': on_time,
            'delayed': delayed,
            'average_delay_days': avg_delay_days,
            'on_time_percentage': (on_time / total * 100) if total > 0 else 0,
            'delayed_percentage': (delayed / total * 100) if total > 0 else 0
        })

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
        queryset = TaskSubmission.objects.filter(
            task_id=self.kwargs['task_pk']
        ).select_related(
            'submitted_by', 'graded_by'
        ).prefetch_related(
            'documents'  # Prefetch related documents for efficiency
        )
        
        # Filter by student if specified
        student_id = self.request.query_params.get('student', None)
        if student_id:
            queryset = queryset.filter(submitted_by_id=student_id)
        
        # Filter by status if specified
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        return queryset

    def get_serializer_class(self):
        if self.action == 'grade':
            return TaskSubmissionGradeSerializer
        return TaskSubmissionSerializer

    def create(self, request, *args, **kwargs):
        """
        Create task submission with support for multiple files.
        Files are uploaded to Google Drive and linked via Document model.
        """
        task_pk = kwargs.get('task_pk')
        
        try:
            task = Task.objects.get(id=task_pk)
        except Task.DoesNotExist:
            return Response(
                {'error': 'Tarea no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if task accepts submissions
        now = timezone.now()
        if task.status == 'CLOSED' and not task.accept_after_close:
            return Response(
                {'error': 'Esta tarea está cerrada y no acepta entregas.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if task.close_date and task.close_date < now:
            if not task.allow_late_submissions and not task.accept_after_close:
                return Response(
                    {'error': 'El plazo para entregar esta tarea ha vencido.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Get files from request
        files = request.FILES.getlist('files[]')
        
        # Validate that at least one of: files, notes, or link is provided
        notes = request.data.get('notes', '').strip()
        link = request.data.get('link', '').strip()
        
        if not files and not notes and not link:
            return Response(
                {'error': 'Debes subir al menos un archivo, agregar un comentario o un enlace'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create the submission (without files in serializer)
        submission_data = {
            'notes': notes,
            'link': link,
            'status': 'SUBMITTED'
        }
        
        serializer = self.get_serializer(data=submission_data)
        serializer.is_valid(raise_exception=True)
        
        task_submission = serializer.save(
            submitted_by=request.user,
            task=task
        )
        
        # Mark as late if submitted after deadline
        if task.close_date and task_submission.created_at > task.close_date:
            task_submission.status = 'LATE'
            task_submission.save()
        
        # Process each file
        uploaded_documents = []
        uploaded_count = 0
        failed_count = 0
        
        for file in files:
            try:
                # Create Document instance
                document = Document.objects.create(
                    task=task,
                    task_submission=task_submission,
                    project=task.project,
                    file=file,
                    uploaded_by=request.user,
                    folder_type='TASK_SUBMISSION'
                )
                
                # Upload to Google Drive (happens automatically in Document.save via thread)
                # But we can also try to upload synchronously for better feedback
                upload_success = self._upload_file_to_drive(document, task, request.user, task_submission)
                
                if upload_success:
                    uploaded_count += 1
                    logger.info(f"✅ File {file.name} uploaded to Drive successfully")
                else:
                    failed_count += 1
                    logger.warning(f"⚠️ File {file.name} saved locally but not uploaded to Drive")
                
                uploaded_documents.append({
                    'id': document.id,
                    'name': document.name,
                    'size': document.file_size,
                    'file_url': document.file.url if document.file else None,
                    'drive_url': document.drive_file_url,
                    'upload_status': document.upload_status
                })
                
            except Exception as file_error:
                logger.error(f'❌ Error processing file {file.name}: {file_error}')
                failed_count += 1
                continue
        
        # Prepare response
        response_data = serializer.data
        response_data['uploaded_files'] = uploaded_documents
        response_data['files_count'] = len(uploaded_documents)
        response_data['uploaded_to_drive_count'] = uploaded_count
        response_data['failed_uploads_count'] = failed_count
        
        # Include documents in response
        response_data['documents'] = uploaded_documents
        
        logger.info(
            f"📤 Submission created: {task_submission.id} | "
            f"Files: {len(files)} | Uploaded to Drive: {uploaded_count} | Failed: {failed_count}"
        )
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post', 'patch'], url_path='grade')
    def grade(self, request, task_pk=None, pk=None):
        """
        Calificar una entrega de tarea.
        Solo TEACHER y ADMIN pueden calificar.
        Envía notificación por email si la tarea es devuelta para revisión.
        """
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para calificar entregas.")
        
        submission = self.get_object()
        task = submission.task
        serializer = TaskSubmissionGradeSerializer(
            submission,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        # Check if submission is being returned for revision
        # A submission is considered "returned" if:
        # 1. It has teacher feedback and is not approved, or
        # 2. Status is not 'GRADED', or
        # 3. Score is below passing threshold (default 70% of max_score)
        is_returned = False
        new_status = request.data.get('status', submission.status)
        new_score = request.data.get('score')
        has_feedback = bool(request.data.get('teacher_feedback'))
        
        if has_feedback and new_status != 'GRADED':
            is_returned = True
        elif new_score is not None and task.max_score:
            # Consider it returned if score is less than passing threshold
            score_value = float(new_score)
            passing_score = float(task.max_score) * PASSING_SCORE_THRESHOLD
            if score_value < passing_score:
                is_returned = True
        
        # Update submission with grading data
        if new_status == 'GRADED':
            submission.status = 'GRADED'
        submission.graded_by = request.user
        submission.graded_at = timezone.now()
        submission = serializer.save()
        
        # Send email notification if task is returned for revision
        if is_returned and has_feedback:
            send_task_returned_notification(task, submission)
        
        return Response({
            'message': 'Entrega calificada exitosamente',
            'submission': TaskSubmissionSerializer(submission).data
        })
    
    @action(detail=False, methods=['get'], url_path='by-student')
    def by_student(self, request, task_pk=None):
        """
        Obtener todas las entregas de la tarea agrupadas por estudiante.
        Solo TEACHER y ADMIN.
        """
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para ver las entregas.")
        
        task = Task.objects.get(id=task_pk)
        submissions = TaskSubmission.objects.filter(
            task=task
        ).select_related(
            'submitted_by', 'graded_by'
        ).prefetch_related(
            'documents'  # Prefetch related documents for efficiency
        )
        
        # Group by student
        students_data = {}
        for submission in submissions:
            student_id = submission.submitted_by.id
            if student_id not in students_data:
                students_data[student_id] = {
                    'student': submission.submitted_by,
                    'submissions': []
                }
            students_data[student_id]['submissions'].append(submission)
        
        # Serialize the data
        result = []
        for student_id, data in students_data.items():
            result.append({
                'student': {
                    'id': data['student'].id,
                    'username': data['student'].username,
                    'full_name': data['student'].get_full_name(),
                    'email': data['student'].email
                },
                'submissions': TaskSubmissionSerializer(data['submissions'], many=True).data,
                'latest_submission': TaskSubmissionSerializer(
                    max(data['submissions'], key=lambda x: x.version)
                ).data
            })
        
        return Response(result)

    def _upload_file_to_drive(self, document, task, user, submission):
        """
        Upload a Document file to Google Drive.
        
        Args:
            document: Document instance
            task: Task instance
            user: User who submitted
            submission: TaskSubmission instance
            
        Returns:
            bool: True if uploaded successfully, False otherwise
        """
        try:
            from apps.documents.services import GoogleDriveService
            
            logger.info(f"📤 [Drive Upload] Starting for document: {document.name}")
            
            # Validate Google Drive configuration
            admin_user_id = settings.GOOGLE_DRIVE_ADMIN_USER_ID
            if not admin_user_id:
                logger.error("❌ [Drive Upload] GOOGLE_DRIVE_ADMIN_USER_ID not configured")
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            
            # Initialize Drive service
            try:
                drive_service = GoogleDriveService(use_institutional=True)
            except ValueError as e:
                logger.error(f"❌ [Drive Upload] Configuration error: {e}")
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            except Exception as e:
                logger.error(f"❌ [Drive Upload] Unexpected error initializing service: {e}")
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            
            # Read file content
            try:
                document.upload_status = 'UPLOADING'
                document.save(update_fields=['upload_status'])
                
                file_content = document.file.read()
                original_filename = document.file.name
                logger.info(f"📄 [Drive Upload] File read: {original_filename} ({len(file_content)} bytes)")
            except Exception as e:
                logger.error(f"❌ [Drive Upload] Error reading file: {e}")
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            
            # Create structured filename
            try:
                new_filename = self._create_structured_filename(submission, original_filename)
                logger.info(f"📝 [Drive Upload] Structured name: {new_filename}")
            except Exception as e:
                logger.error(f"❌ [Drive Upload] Error creating filename: {e}")
                new_filename = os.path.basename(original_filename)
            
            # Get destination folder
            try:
                folder_id = self._get_destination_folder(drive_service, task, user, submission)
                logger.info(f"📁 [Drive Upload] Destination folder: {folder_id}")
            except Exception as e:
                logger.error(f"❌ [Drive Upload] Error getting destination folder: {e}")
                logger.exception(e)
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            
            # Determine MIME type
            mime_type = self._get_mime_type(original_filename)
            logger.info(f"🔖 [Drive Upload] MIME type: {mime_type}")
            
            # Upload file
            try:
                drive_result = drive_service.upload_file(
                    file_name=new_filename,
                    file_content=file_content,
                    folder_id=folder_id,
                    mime_type=mime_type
                )
            except Exception as e:
                logger.error(f"❌ [Drive Upload] Error during upload: {e}")
                logger.exception(e)
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
            
            if drive_result:
                # Update document with Drive info
                document.drive_file_id = drive_result['id']
                document.drive_file_url = drive_result['webViewLink']
                document.upload_status = 'COMPLETE'
                document.save(update_fields=['drive_file_id', 'drive_file_url', 'upload_status'])
                
                # Update TaskSubmission files_metadata
                if submission:
                    if not submission.files_metadata:
                        submission.files_metadata = []
                    
                    # Add metadata for this file
                    submission.files_metadata.append({
                        'name': drive_result.get('name', new_filename),
                        'gdrive_id': drive_result['id'],
                        'size': drive_result.get('size', 0),
                        'mime_type': drive_result.get('mimeType', mime_type),
                        'web_view_link': drive_result['webViewLink'],
                        'document_id': document.id
                    })
                    submission.save(update_fields=['files_metadata'])
                
                logger.info(
                    f"✅ [Drive Upload] Success!\n"
                    f"   - Name: {drive_result['name']}\n"
                    f"   - ID: {drive_result['id']}\n"
                    f"   - Link: {drive_result['webViewLink']}"
                )
                return True
            else:
                logger.warning("⚠️ [Drive Upload] upload_file returned None")
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
                return False
                
        except Exception as e:
            logger.error(f"❌ [Drive Upload] Unexpected error: {e}")
            logger.exception(e)
            if document:
                document.upload_status = 'FAILED'
                document.save(update_fields=['upload_status'])
            return False

    def _upload_to_google_drive(self, task_submission):
        """
        Sube el archivo adjunto a Google Drive institucional usando estructura por proyecto
        
        Returns:
            bool: True si se subió exitosamente, False en caso contrario
        """
        try:
            user = task_submission.submitted_by
            task = task_submission.task
            
            logger.info(f"📤 [Google Drive] Iniciando subida para tarea: {task.title} (ID: {task.id})")
            logger.info(f"📤 [Google Drive] Usuario: {user.get_full_name()} ({user.email})")
            
            # ✅ Validar configuración de Google Drive Admin User
            admin_user_id = settings.GOOGLE_DRIVE_ADMIN_USER_ID
            if not admin_user_id:
                logger.error(
                    "❌ [Google Drive] GOOGLE_DRIVE_ADMIN_USER_ID no está configurado. "
                    "Por favor configure esta variable de entorno con el ID del usuario administrador."
                )
                return False
            
            logger.info(f"✅ [Google Drive] Admin User ID configurado: {admin_user_id}")
            
            # ✅ Usar credenciales institucionales
            try:
                logger.info("🔐 [Google Drive] Intentando inicializar servicio con credenciales institucionales...")
                drive_service = GoogleDriveService(use_institutional=True)
                logger.info("✅ [Google Drive] Servicio inicializado correctamente")
            except ValueError as e:
                # Error de configuración
                logger.error(
                    f"❌ [Google Drive] Error de configuración: {e}\n"
                    f"Verifica que:\n"
                    f"1. GOOGLE_DRIVE_ADMIN_USER_ID esté configurado correctamente\n"
                    f"2. El usuario admin (ID: {admin_user_id}) haya conectado su cuenta de Google Drive\n"
                    f"3. Las credenciales no hayan expirado"
                )
                return False
            except Exception as e:
                logger.error(f"❌ [Google Drive] Error inesperado al inicializar servicio: {e}")
                logger.exception(e)
                return False
            
            # Leer contenido del archivo
            try:
                file_content = task_submission.file.read()
                original_filename = task_submission.file.name
                logger.info(f"📄 [Google Drive] Archivo leído: {original_filename} ({len(file_content)} bytes)")
            except Exception as e:
                logger.error(f"❌ [Google Drive] Error al leer archivo: {e}")
                return False
            
            # Crear nombre estructurado
            try:
                new_filename = self._create_structured_filename(task_submission, original_filename)
                logger.info(f"📝 [Google Drive] Nombre estructurado: {new_filename}")
            except Exception as e:
                logger.error(f"❌ [Google Drive] Error al crear nombre de archivo: {e}")
                return False
            
            # Obtener carpeta destino
            try:
                folder_id = self._get_destination_folder(drive_service, task, user, task_submission)
                logger.info(f"📁 [Google Drive] Carpeta destino: {folder_id}")
            except Exception as e:
                logger.error(f"❌ [Google Drive] Error al obtener carpeta destino: {e}")
                logger.exception(e)
                return False
            
            # Determinar tipo MIME
            mime_type = self._get_mime_type(original_filename)
            logger.info(f"🔖 [Google Drive] Tipo MIME: {mime_type}")
            
            # Subir archivo
            logger.info(f"⬆️  [Google Drive] Iniciando subida de archivo a carpeta {folder_id}...")
            try:
                drive_result = drive_service.upload_file(
                    file_name=new_filename,
                    file_content=file_content,
                    folder_id=folder_id,
                    mime_type=mime_type
                )
            except Exception as e:
                logger.error(f"❌ [Google Drive] Error durante la subida del archivo: {e}")
                logger.exception(e)
                return False
            
            if drive_result:
                # Guardar información del archivo
                task_submission.google_drive_file_id = drive_result['id']
                task_submission.google_drive_link = drive_result['webViewLink']
                task_submission.uploaded_to_drive = True
                
                # Store file metadata
                if not task_submission.files_metadata:
                    task_submission.files_metadata = []
                
                task_submission.files_metadata.append({
                    'name': drive_result['name'],
                    'gdrive_id': drive_result['id'],
                    'size': drive_result.get('size', 0),
                    'mime_type': drive_result.get('mimeType', mime_type),
                    'web_view_link': drive_result['webViewLink']
                })
                
                task_submission.save()
                
                logger.info(
                    f"✅ [Google Drive] Archivo subido exitosamente!\n"
                    f"   - Nombre: {drive_result['name']}\n"
                    f"   - ID: {drive_result['id']}\n"
                    f"   - Link: {drive_result['webViewLink']}"
                )
                return True
            else:
                logger.warning("⚠️  [Google Drive] upload_file retornó None - Archivo guardado localmente pero no se pudo subir a Google Drive")
                return False
                
        except Exception as e:
            logger.error(f"❌ [Google Drive] Error inesperado durante el proceso de subida: {e}")
            logger.exception(e)
            return False

    def _create_structured_filename(self, task_submission, original_filename):
        """
        Crea un nombre de archivo 100% seguro para Google Drive,
        eliminando cualquier carácter especial, acentos o espacios.
        """
        from django.utils.text import slugify
        import os
        import uuid

        task = task_submission.task
        user = task_submission.submitted_by
        
        base_name, extension = os.path.splitext(original_filename)

        clean_task_title = slugify(task.title)[:30]
        clean_user_name = slugify(user.get_full_name() or user.username)[:20]
        date_str = task_submission.created_at.strftime('%d-%m-%y')
        
        unique_id = str(uuid.uuid4())[:8]
    
        safe_name = f"entrega_{clean_task_title}_{clean_user_name}_{date_str}_{unique_id}"
        
        safe_extension = slugify(extension.replace('.', ''))
        
        return f"{safe_name}.{safe_extension}"

    def _get_destination_folder(self, drive_service, task, user, submission):
        """
        Crea estructura de carpetas institucional por proyecto:
        MH Soluciones/[Año]/[Proyecto]/Tareas/[Tarea]/[Estudiante]/Entrega_v[N]
        """
        try:
            date = submission.created_at
            current_year = date.strftime('%Y')
            
            # Root: MH Soluciones
            base_folder_id = drive_service._get_or_create_folder(
                "MH Soluciones", 
                parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
            )
            
            # Year folder
            year_id = drive_service._get_or_create_folder(current_year, parent_id=base_folder_id)
            
            # Project folder
            if task.project:
                project_name = slugify(task.project.name)
            else:
                project_name = "General"
            project_id = drive_service._get_or_create_folder(project_name, parent_id=year_id)
            
            # Tareas folder
            tareas_id = drive_service._get_or_create_folder("Tareas", parent_id=project_id)
            
            # Task folder
            task_name = slugify(task.title)
            task_id = drive_service._get_or_create_folder(task_name, parent_id=tareas_id)
            
            # Student folder
            student_name = slugify(user.get_full_name() or user.username)
            student_id = drive_service._get_or_create_folder(student_name, parent_id=task_id)
            
            # Version folder
            version_folder = f"Entrega_v{submission.version}"
            version_id = drive_service._get_or_create_folder(version_folder, parent_id=student_id)
            
            logger.info(f"Estructura de carpetas creada: {version_folder}")
            return version_id
                
        except Exception as e:
            logger.error(f"Error al crear estructura de carpetas: {e}")
            # Fallback to simple structure
            try:
                base_folder_id = drive_service._get_or_create_folder(
                    "MH Soluciones", 
                    parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
                )
                year_id = drive_service._get_or_create_folder(
                    current_year, 
                    parent_id=base_folder_id
                )
                return drive_service._get_or_create_folder("Entregas de Tareas", parent_id=year_id)
            except:
                return settings.GOOGLE_DRIVE_ROOT_FOLDER_ID

    def _get_mime_type(self, filename):
        """
        Determina el MIME type basado en la extensión del archivo
        """
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or 'application/octet-stream'