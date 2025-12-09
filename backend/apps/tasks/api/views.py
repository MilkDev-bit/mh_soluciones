import logging
import mimetypes
import os

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import viewsets, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser

from apps.documents.services import GoogleDriveService
from ..models import Task, TaskSubmission, TaskComment, TaskEditHistory, TaskReopenLog
from django.db.models import F, Avg
from rest_framework.response import Response
from rest_framework.decorators import action
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
from utils.email_notifications import send_task_assignment_notification, send_task_reopened_notification

logger = logging.getLogger(__name__)

# Role constants to avoid repetition
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')
TEACHER_ROLES = ADMIN_ROLES + ('PROFESSOR', 'DIRECTOR')
EDITOR_ROLES = TEACHER_ROLES


class TaskViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar Tareas.
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
                base_queryset = Task.objects.filter(
                    Q(project__members=user) |
                    Q(assigned_to=user) |
                    Q(assigned_students=user) |
                    Q(created_by=user)
                ).exclude(status='DRAFT').distinct().select_related('project', 'assigned_to').prefetch_related('assigned_students')

        project_id = self.request.query_params.get('project', None)
        if project_id:
            return base_queryset.filter(project_id=project_id)

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
        task = serializer.save(created_by=self.request.user)
        
        # Send email notification if task is assigned
        if task.assigned_to or task.assigned_students.exists():
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
        queryset = TaskSubmission.objects.filter(task_id=self.kwargs['task_pk']).select_related('submitted_by', 'graded_by')
        
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

    def perform_create(self, serializer):
        task = Task.objects.get(id=self.kwargs['task_pk'])
        
        # Check if task accepts submissions
        now = timezone.now()
        if task.status == 'CLOSED' and not task.accept_after_close:
            raise ValidationError("Esta tarea está cerrada y no acepta entregas.")
        
        if task.close_date and task.close_date < now:
            if not task.allow_late_submissions and not task.accept_after_close:
                raise ValidationError("El plazo para entregar esta tarea ha vencido.")
        
        task_submission = serializer.save(
            submitted_by=self.request.user, 
            task_id=self.kwargs['task_pk']
        )
        
        # Mark as late if submitted after deadline
        if task.close_date and task_submission.created_at > task.close_date:
            task_submission.status = 'LATE'
            task_submission.save()
        
        if task_submission.file:
            self._upload_to_google_drive(task_submission)
    
    @action(detail=True, methods=['post', 'patch'], url_path='grade')
    def grade(self, request, task_pk=None, pk=None):
        """
        Calificar una entrega de tarea.
        Solo TEACHER y ADMIN pueden calificar.
        """
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para calificar entregas.")
        
        submission = self.get_object()
        serializer = TaskSubmissionGradeSerializer(
            submission,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        # Update submission with grading data
        submission.status = 'GRADED'
        submission.graded_by = request.user
        submission.graded_at = timezone.now()
        serializer.save()
        
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
        submissions = TaskSubmission.objects.filter(task=task).select_related('submitted_by', 'graded_by')
        
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

    def _upload_to_google_drive(self, task_submission):
        """
        Sube el archivo adjunto a Google Drive usando la estructura de Teams
        """
        try:
            user = task_submission.submitted_by
            task = task_submission.task
            
            logger.info(f"Iniciando subida a Google Drive para entrega de tarea: {task.title}")
            
            drive_service = GoogleDriveService(user)
            
            file_content = task_submission.file.read()
            original_filename = task_submission.file.name
            
            new_filename = self._create_structured_filename(task_submission, original_filename)
            
            folder_id = self._get_destination_folder(drive_service, task, user, task_submission)
            
            mime_type = self._get_mime_type(original_filename)
            
            logger.info(f"Subiendo archivo: {new_filename} a carpeta ID: {folder_id}")
            
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
                
                logger.info(f"Archivo subido exitosamente a Google Drive: {drive_result['name']} (ID: {drive_result['id']})")
            else:
                logger.warning("Archivo guardado localmente pero no se pudo subir a Google Drive")
                
        except Exception as e:
            logger.exception(f"Error al subir a Google Drive: {e}")

    def _create_structured_filename(self, task_submission, original_filename):
        """
        Crea un nombre de archivo estructurado similar al de upload_document
        """
        task = task_submission.task
        user = task_submission.submitted_by
        
        task_title = slugify(task.title)
        responsible_name = slugify(user.get_full_name() or user.username)
        date_str = task_submission.created_at.strftime('%d-%m-%y')
        
        filename, extension = os.path.splitext(original_filename)
        
        return f"entrega_{task_title}_{responsible_name}_{date_str}{extension}"

    def _get_destination_folder(self, drive_service, task, user, submission):
        """
        Crea estructura de carpetas según el formato de Teams:
        MH Soluciones/[Año]/[Curso]/[Asignatura]/Tarea_[N]/[Usuario_Estudiante]/Entrega_v[N]
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
            
            # Course/Project folder
            if task.project:
                course_name = slugify(task.project.name)
            else:
                course_name = "General"
            course_id = drive_service._get_or_create_folder(course_name, parent_id=year_id)
            
            # Subject folder (using project or generic)
            subject_name = "Asignatura_General"
            if task.project and hasattr(task.project, 'subject'):
                subject_name = slugify(task.project.subject)
            subject_id = drive_service._get_or_create_folder(subject_name, parent_id=course_id)
            
            # Task folder: Tarea_[number or id]
            task_folder_name = f"Tarea_{task.id}"
            task_id = drive_service._get_or_create_folder(task_folder_name, parent_id=subject_id)
            
            # Student folder: [Full_Name]_[Username or ID]
            student_name = slugify(user.get_full_name() or user.username)
            student_identifier = user.username or f"ID{user.id}"
            student_folder_name = f"{student_name}_{student_identifier}"
            student_id = drive_service._get_or_create_folder(student_folder_name, parent_id=task_id)
            
            # Version folder: Entrega_v[N]
            version_folder_name = f"Entrega_v{submission.version}"
            version_id = drive_service._get_or_create_folder(version_folder_name, parent_id=student_id)
            
            logger.info(f"Estructura de carpetas creada: {version_folder_name}")
            return version_id
                
        except Exception as e:
            logger.error(f"Error al crear estructura de carpetas: {e}")
            # Fallback to simple structure
            try:
                year_id = drive_service._get_or_create_folder(
                    current_year, 
                    parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
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