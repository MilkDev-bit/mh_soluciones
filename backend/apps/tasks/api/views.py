import logging
import mimetypes
import os

from django.conf import settings
from django.db import transaction
from django.db.models import Q, F, Avg, Count, Max, Prefetch
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import viewsets, permissions, status, serializers
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
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
from apps.documents.tasks import upload_document_to_drive
from ..models import Task, TaskSubmission, TaskComment, TaskEditHistory, TaskReopenLog
from .. import deadlines, review
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


def student_visible_tasks_q(user):
    """
    Tareas que ve un alumno/empleado.

    [FIX] Antes bastaba con ser miembro del proyecto para ver TODAS sus tareas,
    incluidas las asignadas a otros usuarios; como el alumno no las había
    entregado, le aparecían en "Vencidas" o "Pendientes". Ahora ve:
      - las tareas asignadas a él (assigned_to o assigned_students),
      - las que creó,
      - y las tareas generales de sus proyectos (sin nadie asignado).
    """
    from apps.projects.models import ProjectMember

    member_project_ids = ProjectMember.objects.filter(user=user).values('project_id')
    tasks_with_assignees = Task.assigned_students.through.objects.values('task_id')
    general_project_task = (
        Q(project_id__in=member_project_ids)
        & Q(assigned_to__isnull=True)
        & ~Q(id__in=tasks_with_assignees)
    )
    return (
        Q(assigned_to=user)
        | Q(assigned_students=user)
        | Q(created_by=user)
        | general_project_task
    )


def is_task_assignee(task, user):
    if task.assigned_to_id == user.pk:
        return True
    return any(s.pk == user.pk for s in task.assigned_students.all())


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
            elif user.role == 'CLIENT':
                # Clients see all tasks from projects where they are the client FK or a member
                from apps.projects.models import ProjectMember
                member_project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
                base_queryset = Task.objects.filter(
                    Q(project__client=user) | Q(project_id__in=member_project_ids)
                ).exclude(status='DRAFT').distinct().select_related('project', 'assigned_to').prefetch_related('assigned_students')
                logger.info(f"Client {user.username} (ID: {user.id}) queryset count: {base_queryset.count()}")
            else:
                # Students see only tasks assigned to them or their project tasks
                # Using multiple conditions to ensure tasks are visible:
                # 1. Student is a member of the project (through ProjectMember)
                # 2. Task is directly assigned to the student
                # 3. Student is in assigned_students field
                # 4. Student created the task
                base_queryset = Task.objects.filter(
                    student_visible_tasks_q(user)
                ).exclude(status='DRAFT').distinct().select_related('project', 'assigned_to').prefetch_related('assigned_students')
                
                logger.info(f"Student {user.username} (ID: {user.id}) queryset count: {base_queryset.count()}")

        base_queryset = self._with_review_data(base_queryset, user)

        project_id = getattr(self.request, 'query_params', self.request.GET).get('project', None)
        if project_id:
            return base_queryset.filter(project_id=project_id).order_by('-created_at')

        return base_queryset.order_by('-created_at')

    @staticmethod
    def _with_review_data(queryset, user):
        """Anotaciones y prefetch para que el serializer no haga N+1 queries.

        - submissions_total / last_submission_at / pending_review_total: conteos.
        - reopen_logs__specific_students: prórrogas por alumno (deadlines.py).
        - my_submissions: últimas entregas del alumno actual (ventana de entrega).
        """
        queryset = queryset.annotate(
            submissions_total=Count('submissions', distinct=True),
            last_submission_at=Max('submissions__created_at'),
            pending_review_total=Count(
                'submissions',
                filter=Q(submissions__status__in=['SUBMITTED', 'IN_REVIEW', 'LATE']),
                distinct=True,
            ),
        ).prefetch_related('reopen_logs__specific_students')
        if user.role not in TEACHER_ROLES:
            queryset = queryset.prefetch_related(Prefetch(
                'submissions',
                queryset=TaskSubmission.objects.filter(submitted_by=user)
                .select_related('reviewer').order_by('-version'),
                to_attr='my_submissions',
            ))
        return queryset

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TaskCreateUpdateSerializer
        if self.action == 'retrieve':
            return TaskDetailSerializer
        if self.action == 'reopen':
            return TaskReopenSerializer
        return TaskSerializer



    def perform_create(self, serializer):
        if self.request.user.role == 'CLIENT':
            raise PermissionDenied("Los clientes no pueden crear tareas.")
        if self.request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para crear tareas.")

        # Get validated data to check for assigned users
        validated_data = serializer.validated_data
        has_assigned_to = validated_data.get('assigned_to') is not None
        has_assigned_students = bool(validated_data.get('assigned_students'))

        # serializer.save() creates the Task AND sets assigned_students M2M
        # before returning, so by this point all DB data is committed.
        task = serializer.save(created_by=self.request.user)

        # Use transaction.on_commit() to guarantee the WebSocket notification
        # is sent only AFTER the full DB transaction commits (task + M2M).
        # This prevents students from receiving a notification and immediately
        # hitting the API before assigned_students is visible in the DB,
        # which was causing intermittent 403 errors.
        if has_assigned_to or has_assigned_students:
            task_id = task.id

            def notify():
                try:
                    from ..models import Task as TaskModel
                    from apps.notifications.models import Notification
                    from apps.notifications.api.serializers import NotificationSerializer
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync

                    refreshed = TaskModel.objects.prefetch_related('assigned_students').select_related('project').get(pk=task_id)

                    recipients = set()
                    if refreshed.assigned_to:
                        recipients.add(refreshed.assigned_to)
                    recipients.update(refreshed.assigned_students.all())
                    # Don't notify the creator
                    recipients.discard(refreshed.created_by)

                    channel_layer = get_channel_layer()
                    for recipient in recipients:
                        notification = Notification.objects.create(
                            user=recipient,
                            title="Nueva Tarea Asignada",
                            message=f"Se te ha asignado una nueva tarea: '{refreshed.title}' en el proyecto '{refreshed.project.name}'.",
                            notification_type=Notification.NotificationType.TASK_ASSIGNED,
                            content_object=refreshed,
                        )
                        serialized = NotificationSerializer(notification).data
                        async_to_sync(channel_layer.group_send)(
                            f'user_{recipient.id}_notifications',
                            {'type': 'send_notification', 'message': serialized},
                        )

                    send_task_assignment_notification(refreshed)
                except Exception as exc:
                    logger.error("Error enviando notificaciones de tarea %s: %s", task_id, exc)

            transaction.on_commit(notify)

    # Campos que un alumno asignado puede modificar: solo la descripción, donde
    # GraficasActivityTable guarda sus datos (<!-- GRAFICAS_DATA: ... -->).
    STUDENT_EDITABLE_FIELDS = {'description'}

    def perform_update(self, serializer):
        instance = self.get_object()
        if self.request.user.role not in TEACHER_ROLES:
            is_assigned = self.request.user == instance.assigned_to or instance.assigned_students.filter(id=self.request.user.id).exists()
            is_member = instance.project and instance.project.projectmember_set.filter(user=self.request.user).exists()
            if not (is_assigned or is_member or self.request.user == instance.created_by):
                raise PermissionDenied("No tienes permisos para editar tareas.")
            # [FIX seguridad] Antes un alumno podía cambiar status, fechas o
            # alumnos asignados vía PATCH (p. ej. marcar la tarea como COMPLETED).
            forbidden = set(serializer.validated_data) - self.STUDENT_EDITABLE_FIELDS
            if forbidden:
                raise PermissionDenied(
                    "Solo puedes actualizar los datos de la actividad. "
                    f"Campos no permitidos: {', '.join(sorted(forbidden))}."
                )

        # Guardar los datos de GRAFICAS no es una edición de la tarea: no ensuciar el historial.
        only_graficas_data = (
            set(serializer.validated_data) == {'description'}
            and 'GRAFICAS_DATA' in (serializer.validated_data.get('description') or '')
        )

        # Check if task has submissions - use count() for better performance
        submission_count = 0 if only_graficas_data else instance.submissions.count()
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
        Reabrir la tarea o dar prórroga.

        - specific_students = [ids]: prórroga SOLO para esos alumnos. La fecha
          general y el estado de la tarea no cambian.
        - sin alumnos: nueva fecha límite general y estado REOPENED.
        Acepta new_deadline (datetime) o days (N días a partir de hoy, hasta las 23:59).
        """
        task = self.get_object()
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para reabrir tareas.")

        serializer = TaskReopenSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        new_deadline = serializer.validated_data['new_deadline']
        student_ids = serializer.validated_data.get('specific_students') or []

        from apps.authentication.models import CustomUser
        with transaction.atomic():
            reopen_log = TaskReopenLog.objects.create(
                task=task,
                reopened_by=request.user,
                new_deadline=new_deadline,
                reason=serializer.validated_data.get('reason', ''),
            )
            if student_ids:
                students = list(CustomUser.objects.filter(id__in=student_ids))
                reopen_log.specific_students.set(students)
                message = f"Prórroga otorgada a {len(students)} alumno(s) hasta el {deadlines.fmt(new_deadline)}."
            else:
                students = list(task.assigned_students.all())
                if task.assigned_to and task.assigned_to not in students:
                    students.append(task.assigned_to)
                task.status = Task.TaskStatus.REOPENED
                task.close_date = new_deadline
                task.due_date = timezone.localtime(new_deadline).date()
                task.save(update_fields=['status', 'close_date', 'due_date', 'updated_at'])
                message = f"Tarea reabierta para todos hasta el {deadlines.fmt(new_deadline)}."

        transaction.on_commit(lambda: review.notify_extension(task, students, new_deadline))
        try:
            send_task_reopened_notification(task, reopen_log)
        except Exception as exc:
            logger.error("Error enviando correo de reapertura de tarea %s: %s", task.pk, exc)

        task = self._with_review_data(Task.objects.filter(pk=task.pk), request.user).get()
        return Response({
            'message': message,
            'task': TaskDetailSerializer(task, context={'request': request}).data
        })

    @action(detail=True, methods=['post'], url_path='duplicate')
    def duplicate(self, request, pk=None):
        """
        Duplicar una tarea completada para una nueva semana.
        Establece open_date a hoy y close_date al próximo domingo a las 14:00.
        Solo SUPERADMIN puede duplicar tareas.
        """
        if request.user.role != 'SUPERADMIN':
            raise PermissionDenied("No tienes permisos para duplicar tareas.")
            
        original_task = self.get_object()
        
        # Calcular fechas
        from django.utils import timezone
        import datetime
        
        now = timezone.now()
        # [FIX zona horaria] Antes se usaba la hora UTC: el "domingo 14:00"
        # quedaba en domingo 08:00 en México y, después de las 18:00 de un
        # sábado local, el cálculo ya caía en el domingo siguiente.
        local_now = timezone.localtime(now)
        days_to_sunday = (6 - local_now.weekday()) % 7
        close_date = (local_now + datetime.timedelta(days=days_to_sunday)).replace(
            hour=14, minute=0, second=0, microsecond=0)
        if close_date <= local_now:  # domingo después de las 14:00 → siguiente domingo
            close_date += datetime.timedelta(days=7)
        
        # Crear duplicado — solo título, proyecto, fechas y estudiantes
        new_task = Task.objects.create(
            title=original_task.title,
            project=original_task.project,
            created_by=request.user,
            assigned_to=original_task.assigned_to,
            status=Task.TaskStatus.OPEN,
            due_date=close_date.date(),
            open_date=now,
            close_date=close_date,
            allow_late_submissions=original_task.allow_late_submissions,
            accept_after_close=original_task.accept_after_close,
            days_after_close=original_task.days_after_close,
            is_continuous=original_task.is_continuous,
            max_score=original_task.max_score,
            grading_criteria=original_task.grading_criteria,
        )
        
        # Copiar estudiantes asignados (M2M)
        if original_task.assigned_students.exists():
            new_task.assigned_students.set(original_task.assigned_students.all())
            
        return Response({
            'message': 'Tarea duplicada exitosamente',
            'task': TaskSerializer(new_task).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='my-tasks')
    def my_tasks(self, request):
        """
        Tareas del alumno agrupadas según su situación real.

        Antes: 'vencida' solo miraba close_date (ignoraba due_date, días de
        gracia, prórrogas y actividades continuas) y cualquier entrega no
        calificada caía en 'entregadas', aunque se la hubieran devuelto.
        """
        user = request.user
        if user.role not in ['STUDENT', 'PROFESSOR']:
            return Response({'error': 'Este endpoint es solo para estudiantes'},
                            status=status.HTTP_403_FORBIDDEN)

        tasks = Task.objects.filter(
            Q(assigned_students=user) | Q(assigned_to=user)
        ).exclude(status='DRAFT').distinct().select_related('project', 'assigned_to')
        tasks = self._with_review_data(tasks, user)
        if user.role in TEACHER_ROLES:  # PROFESSOR también recibe sus propias entregas
            tasks = tasks.prefetch_related(Prefetch(
                'submissions',
                queryset=TaskSubmission.objects.filter(submitted_by=user)
                .select_related('reviewer').order_by('-version'),
                to_attr='my_submissions',
            ))

        buckets = {key: [] for key in (
            'to_submit', 'late', 'changes_requested', 'submitted', 'graded', 'overdue'
        )}
        state_to_bucket = {
            deadlines.STATE_NO_DEADLINE: 'to_submit',
            deadlines.STATE_OPEN: 'to_submit',
            deadlines.STATE_DUE_SOON: 'to_submit',
            deadlines.STATE_NOT_OPEN: 'to_submit',
            deadlines.STATE_LATE_WINDOW: 'late',
            deadlines.STATE_CORRECTION: 'changes_requested',
            deadlines.STATE_IN_REVIEW: 'submitted',
            deadlines.STATE_APPROVED: 'graded',
            deadlines.STATE_OVERDUE: 'overdue',
            deadlines.STATE_CLOSED: 'overdue',
        }
        for task in tasks:
            latest = deadlines.latest_submission_for(task, user)
            window = deadlines.submission_window(task, user, latest_submission=latest)
            bucket = state_to_bucket.get(window.state, 'to_submit')
            # Entregada y esperando revisión (puede reemplazarla mientras siga abierta)
            if latest and latest.status in TaskSubmission.PENDING_REVIEW_STATUSES:
                bucket = 'submitted'
            elif latest and window.state == deadlines.STATE_CLOSED:
                bucket = 'graded' if latest.status in TaskSubmission.FINAL_STATUSES else 'submitted'
            buckets[bucket].append(task)

        ser = lambda items: TaskSerializer(items, many=True, context={'request': request}).data
        return Response({key: ser(items) for key, items in buckets.items()})

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
        
        # [FIX] Usaba el campo inexistente `completed_at` (FieldError → error 500).
        # Se toma la fecha local de la última actualización como fecha de cierre.
        total = queryset.count()
        on_time = 0
        delays = []
        for completed_at, due_date in queryset.exclude(due_date=None).values_list('updated_at', 'due_date'):
            delay = (timezone.localtime(completed_at).date() - due_date).days
            if delay > 0:
                delays.append(delay)
            else:
                on_time += 1
        delayed = len(delays)
        avg_delay_days = round(sum(delays) / delayed, 1) if delayed else 0
        
        return Response({
            'total': total,
            'on_time': on_time,
            'delayed': delayed,
            'average_delay_days': avg_delay_days,
            'on_time_percentage': (on_time / total * 100) if total > 0 else 0,
            'delayed_percentage': (delayed / total * 100) if total > 0 else 0
        })

    @action(detail=True, methods=['get'], url_path='review-board')
    def review_board(self, request, pk=None):
        """
        Tablero de revisión: UNA fila por alumno asignado (haya entregado o no),
        con el estado de su última versión y quién la revisa.

        Reemplaza a submissions/by-student, que solo listaba a quienes ya
        entregaron y mezclaba las versiones y los revisores.
        """
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para revisar entregas.")
        task = self.get_object()

        students = {u.pk: u for u in task.assigned_students.all()}
        if task.assigned_to_id:
            students.setdefault(task.assigned_to_id, task.assigned_to)

        subs = (TaskSubmission.objects.filter(task=task)
                .select_related('submitted_by', 'graded_by', 'reviewer')
                .prefetch_related('documents').order_by('submitted_by_id', '-version'))
        by_student = {}
        for sub in subs:
            by_student.setdefault(sub.submitted_by_id, []).append(sub)
            students.setdefault(sub.submitted_by_id, sub.submitted_by)

        rows = []
        summary = {'total': 0, 'missing': 0, 'to_review': 0, 'in_review': 0,
                   'in_review_mine': 0, 'changes_requested': 0, 'approved': 0, 'late': 0}
        for student_id, student in students.items():
            history = by_student.get(student_id, [])
            latest = history[0] if history else None
            window = deadlines.submission_window(task, student, latest_submission=latest)
            if latest is None:
                state = 'MISSING'
                summary['missing'] += 1
            elif latest.status in TaskSubmission.FINAL_STATUSES:
                state = 'APPROVED'
                summary['approved'] += 1
            elif latest.status == 'CHANGES_REQUESTED':
                state = 'CHANGES_REQUESTED'
                summary['changes_requested'] += 1
            elif latest.status == 'IN_REVIEW':
                state = 'IN_REVIEW'
                summary['in_review'] += 1
                if latest.reviewer_id == request.user.pk:
                    summary['in_review_mine'] += 1
            else:
                state = 'TO_REVIEW'
                summary['to_review'] += 1
            if latest is not None and (latest.is_late or latest.status == 'LATE'):
                summary['late'] += 1
            summary['total'] += 1

            rows.append({
                'student': {
                    'id': student.pk,
                    'full_name': student.get_full_name() or student.username,
                    'email': student.email,
                },
                'state': state,
                'window': window.as_dict(),
                'latest_submission': TaskSubmissionSerializer(
                    latest, context={'request': request}).data if latest else None,
                'history': TaskSubmissionSerializer(
                    history[1:], many=True, context={'request': request}).data,
            })

        order = {'TO_REVIEW': 0, 'IN_REVIEW': 1, 'CHANGES_REQUESTED': 2, 'MISSING': 3, 'APPROVED': 4}
        rows.sort(key=lambda r: (order[r['state']], r['student']['full_name'].lower()))
        return Response({
            'task': {
                'id': task.pk,
                'title': task.title,
                'max_score': task.max_score,
                'deadline': (deadlines.task_deadline(task).isoformat()
                             if deadlines.task_deadline(task) else None),
                'is_continuous': task.is_continuous,
            },
            'summary': summary,
            'rows': rows,
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
    # [FIX] Sin JSONParser, /grade/ y /review/ respondían 415 a las peticiones JSON del frontend.
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_classes = [CanInteractWithTask]

    def get_queryset(self):
        queryset = TaskSubmission.objects.filter(
            task_id=self.kwargs['task_pk']
        ).select_related(
            'submitted_by', 'graded_by', 'reviewer'
        ).prefetch_related(
            'documents'  # Prefetch related documents for efficiency
        )

        # [FIX privacidad] Un alumno solo ve sus propias entregas (antes veía las
        # de todos los asignados a la tarea). Revisores y clientes ven todas.
        user = self.request.user
        if user.role not in TEACHER_ROLES and user.role != 'CLIENT':
            queryset = queryset.filter(submitted_by=user)
        
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

    def perform_update(self, serializer):
        # Un alumno solo puede editar notas y enlace de su propia entrega
        # mientras nadie la está revisando; la revisión va por /review/.
        sub = serializer.instance
        user = self.request.user
        if user.role not in TEACHER_ROLES:
            if sub.submitted_by_id != user.pk:
                raise PermissionDenied("Solo puedes editar tus propias entregas.")
            if sub.status not in ('SUBMITTED', 'LATE'):
                raise PermissionDenied("Esta entrega ya está en revisión o fue revisada; envía una nueva versión.")
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role not in ADMIN_ROLES:
            raise PermissionDenied("Solo un administrador puede eliminar entregas.")
        instance.delete()

    def create(self, request, *args, **kwargs):
        """
        Create task submission with support for multiple files.
        Files are uploaded to Google Drive and linked via Document model.
        """
        task_pk = kwargs.get('task_pk')
        
        try:
            task = Task.objects.prefetch_related('reopen_logs__specific_students').get(id=task_pk)
        except Task.DoesNotExist:
            return Response(
                {'error': 'Tarea no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Solo pueden entregar los usuarios asignados (si la tarea tiene asignados).
        has_assignees = task.assigned_to_id or task.assigned_students.exists()
        if (request.user.role not in TEACHER_ROLES and has_assignees
                and not is_task_assignee(task, request.user)):
            return Response(
                {'error': 'Esta tarea está asignada a otros usuarios; no puedes entregarla.',
                 'code': 'NOT_ASSIGNED'},
                status=status.HTTP_403_FORBIDDEN
            )

        # [FIX] Una sola regla de plazo (deadlines.py): fecha límite local,
        # días de gracia, prórrogas por alumno, correcciones y actividades
        # continuas. Se valida ANTES de procesar archivos y se responde con un
        # código y un mensaje específicos en lugar de "el plazo ha vencido".
        previous = (TaskSubmission.objects.filter(task=task, submitted_by=request.user)
                    .select_related('reviewer').order_by('-version').first())
        window = deadlines.submission_window(task, request.user, latest_submission=previous)
        if not window.can_submit:
            return Response(
                {'error': window.message, 'code': window.state, 'window': window.as_dict()},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get files from request (support both 'file' and 'files[]' for frontend compatibility)
        files = request.FILES.getlist('files[]')
        if not files:
            files = request.FILES.getlist('file')
        
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
        }
        
        serializer = self.get_serializer(data=submission_data)
        serializer.is_valid(raise_exception=True)
        
        # "Tardía" es un atributo; el estado sigue siendo "Por revisar".
        task_submission = serializer.save(
            submitted_by=request.user,
            task=task,
            status=TaskSubmission.SubmissionStatus.SUBMITTED,
            is_late=window.is_late,
        )

        # Las versiones anteriores sin decisión final ya no se revisan.
        TaskSubmission.objects.filter(
            task=task, submitted_by=request.user, version__lt=task_submission.version,
        ).exclude(status__in=TaskSubmission.FINAL_STATUSES).update(
            status=TaskSubmission.SubmissionStatus.SUPERSEDED, reviewer=None,
        )
        
        # Process each file
        uploaded_documents = []
        uploaded_count = 0
        failed_count = 0
        
        for file in files:
            try:
                # Create local document record
                from apps.documents.models import Document
                document = Document.objects.create(
                    task=task,
                    task_submission=task_submission,
                    project=task.project,
                    file=file,
                    uploaded_by=request.user,
                    folder_type='TASK_SUBMISSION'
                )
                
                # Subir a Drive: síncrono si no hay Celery worker, async si hay worker disponible
                from apps.documents.api.views import _is_celery_worker_available, _run_upload_sync
                if _is_celery_worker_available():
                    try:
                        upload_document_to_drive.delay(document.id)
                        logger.info(f"📤 Tarea Drive encolada para documento ID={document.id}")
                    except Exception as drive_error:
                        logger.warning(f"⚠️ Error al encolar tarea Celery: {drive_error}. Ejecutando síncronamente...")
                        _run_upload_sync(document)
                else:
                    logger.info(f"⚡ Sin worker Celery disponible, subida síncrona para documento ID={document.id}")
                    _run_upload_sync(document)

                uploaded_count += 1
                
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
        
        # PERSIST METADATA to the database
        if uploaded_documents:
            task_submission.files_metadata = uploaded_documents
            task_submission.save(update_fields=['files_metadata'])

        # If submission includes a link, save a Document record and back it up to Drive
        if link:
            try:
                from apps.documents.models import Document
                from apps.documents.services import GoogleDriveService
                import urllib.parse as _urlparse
                from django.utils.text import slugify

                link_name = _urlparse.urlparse(link).netloc or link[:80]
                clean_task = slugify(task.title)[:30]
                clean_user = slugify(request.user.get_full_name() or request.user.username)[:20]
                date_str = task_submission.created_at.strftime('%d-%m-%y')

                link_doc = Document.objects.create(
                    task=task,
                    task_submission=task_submission,
                    project=task.project,
                    uploaded_by=request.user,
                    folder_type='TASK_SUBMISSION',
                    is_link=True,
                    link=link,
                    name=f"Enlace: {link_name}",
                    upload_status=Document.UploadStatus.PENDING,
                )
                logger.info(f"🔗 Document link record created: {link_doc.id} -> {link}")

                admin_user_id = settings.GOOGLE_DRIVE_ADMIN_USER_ID
                if not admin_user_id:
                    logger.warning("⚠️ GOOGLE_DRIVE_ADMIN_USER_ID not set, skipping Drive backup for link")
                    link_doc.upload_status = Document.UploadStatus.FAILED
                    link_doc.save(update_fields=['upload_status'])
                else:
                    try:
                        drive_service = GoogleDriveService(use_institutional=True)
                        folder_id = self._get_destination_folder(
                            drive_service, task, request.user, task_submission
                        )

                        # ── Strategy 1: try to copy the Google file as a frozen snapshot ──
                        file_id = GoogleDriveService.extract_file_id_from_url(link)
                        drive_result = None

                        if file_id:
                            copy_name = f"snapshot_{clean_task}_{clean_user}_{date_str}_v{task_submission.version}"
                            drive_result = drive_service.copy_file(
                                source_file_id=file_id,
                                new_name=copy_name,
                                folder_id=folder_id,
                            )
                            if drive_result:
                                logger.info(
                                    f"✅ [Drive] Frozen snapshot created via copy: "
                                    f"{drive_result.get('webViewLink')}"
                                )
                            else:
                                logger.warning(
                                    "⚠️ [Drive] copy_file failed (document may be private). "
                                    "Falling back to .txt reference."
                                )

                        # ── Strategy 2 (fallback): upload a .txt with the URL ──
                        if not drive_result:
                            txt_filename = f"enlace_{clean_task}_{clean_user}_{date_str}_v{task_submission.version}.txt"
                            txt_content = (
                                f"Enlace de entrega\n"
                                f"==================\n"
                                f"Tarea:      {task.title}\n"
                                f"Proyecto:   {task.project.name if task.project else 'N/A'}\n"
                                f"Estudiante: {request.user.get_full_name() or request.user.username}\n"
                                f"Fecha:      {task_submission.created_at.strftime('%d/%m/%Y %H:%M')}\n"
                                f"Versión:    v{task_submission.version}\n"
                                f"\nNOTA: No fue posible crear una copia del documento.\n"
                                f"El documento puede ser privado o no es un archivo de Google Drive.\n"
                                f"\nURL original:\n{link}\n"
                            ).encode('utf-8')
                            drive_result = drive_service.upload_file(
                                file_name=txt_filename,
                                file_content=txt_content,
                                folder_id=folder_id,
                                mime_type='text/plain',
                            )
                            if drive_result:
                                logger.info(
                                    f"✅ [Drive] .txt reference uploaded as fallback: "
                                    f"{drive_result.get('webViewLink')}"
                                )

                        # ── Save Drive result to the Document record ──
                        if drive_result:
                            link_doc.drive_file_id = drive_result.get('id')
                            link_doc.drive_file_url = drive_result.get('webViewLink')
                            link_doc.upload_status = Document.UploadStatus.COMPLETE
                            # Use the Drive filename as the document name so it's descriptive in UI
                            link_doc.name = drive_result.get('name', link_doc.name)
                            link_doc.save(update_fields=['drive_file_id', 'drive_file_url', 'upload_status', 'name'])
                        else:
                            link_doc.upload_status = Document.UploadStatus.FAILED
                            link_doc.save(update_fields=['upload_status'])
                            logger.warning("⚠️ [Drive] Both copy and .txt fallback failed for link backup")

                    except Exception as drive_link_error:
                        logger.warning(f"⚠️ Could not backup link to Drive: {drive_link_error}")
                        link_doc.upload_status = Document.UploadStatus.FAILED
                        link_doc.save(update_fields=['upload_status'])

            except Exception as link_doc_error:
                logger.warning(f"⚠️ Could not create Document record for link: {link_doc_error}")
        
        # Prepare response
        response_data = serializer.data
        response_data['uploaded_files'] = uploaded_documents
        response_data['files_count'] = len(uploaded_documents)
        response_data['uploaded_to_drive_count'] = uploaded_count
        response_data['failed_uploads_count'] = failed_count
        response_data['message'] = (
            'Corrección enviada. Tu revisor la verá en su lista.' if window.state == deadlines.STATE_CORRECTION
            else 'Entrega tardía registrada. Quedará marcada como fuera de tiempo.' if window.is_late
            else 'Entrega registrada. Te avisaremos cuando sea revisada.'
        )
        if failed_count:
            response_data['message'] += f' {failed_count} archivo(s) no se pudieron procesar; vuelve a subirlos.'
        
        # Include documents in response
        response_data['documents'] = uploaded_documents
        
        logger.info(
            f"📤 Submission created: {task_submission.id} | "
            f"Files: {len(files)} | Uploaded to Drive: {uploaded_count} | Failed: {failed_count}"
        )
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    def _review_response(self, func, *args, **kwargs):
        try:
            sub = func(*args, **kwargs)
        except review.ReviewError as exc:
            return Response({'error': exc.message, 'code': exc.code}, status=exc.http_status)
        sub = TaskSubmission.objects.select_related('submitted_by', 'graded_by', 'reviewer') \
            .prefetch_related('documents').get(pk=sub.pk)
        return Response({'submission': TaskSubmissionSerializer(sub, context={'request': self.request}).data})

    @action(detail=True, methods=['post'], url_path='claim')
    def claim(self, request, task_pk=None, pk=None):
        """Tomar la entrega para revisarla (evita que dos revisores la califiquen a la vez)."""
        sub = self.get_object()
        resp = self._review_response(review.claim, sub.pk, request.user,
                                     force=bool(request.data.get('force')))
        if resp.status_code == 200:
            resp.data['message'] = 'Entrega asignada a ti para revisión.'
        return resp

    @action(detail=True, methods=['post'], url_path='release')
    def release(self, request, task_pk=None, pk=None):
        """Soltar la entrega para que otro revisor pueda tomarla."""
        sub = self.get_object()
        resp = self._review_response(review.release, sub.pk, request.user)
        if resp.status_code == 200:
            resp.data['message'] = 'Entrega liberada. Otro revisor puede tomarla.'
        return resp

    @action(detail=True, methods=['post'], url_path='review')
    def review(self, request, task_pk=None, pk=None):
        """
        Decidir sobre la entrega: {decision: 'approve' | 'request_changes',
        teacher_feedback, score?, criteria_scores?}.
        """
        sub = self.get_object()
        score = request.data.get('score')
        try:
            score = float(score) if score not in (None, '') else None
        except (TypeError, ValueError):
            return Response({'error': 'La puntuación debe ser un número.', 'code': 'INVALID_SCORE'},
                            status=status.HTTP_400_BAD_REQUEST)
        decision = request.data.get('decision')
        resp = self._review_response(
            review.decide, sub.pk, request.user, decision,
            feedback=request.data.get('teacher_feedback', ''),
            score=score,
            criteria_scores=request.data.get('criteria_scores'),
        )
        if resp.status_code == 200:
            resp.data['message'] = ('Entrega aprobada. Se notificó al alumno.' if decision == 'approve'
                                    else 'Entrega devuelta con cambios. Se notificó al alumno.')
        return resp

    @action(detail=True, methods=['post', 'patch'], url_path='grade')
    def grade(self, request, task_pk=None, pk=None):
        """
        Compatibilidad con clientes anteriores. Usa el mismo flujo que /review/.
        Sin `decision`, se aprueba si la puntuación alcanza el mínimo
        (PASSING_SCORE_THRESHOLD) y se devuelve con cambios si no. Antes siempre
        quedaba como GRADED y además se enviaba el correo de "devuelta".
        """
        if request.user.role not in TEACHER_ROLES:
            raise PermissionDenied("No tienes permisos para calificar entregas.")
        sub = self.get_object()
        decision = request.data.get('decision')
        score = request.data.get('score')
        score = float(score) if score not in (None, '') else None
        if decision not in ('approve', 'request_changes'):
            passing = float(sub.task.max_score) * PASSING_SCORE_THRESHOLD
            decision = 'request_changes' if (score is not None and score < passing) else 'approve'
        feedback = request.data.get('teacher_feedback', '')
        if decision == 'request_changes' and not feedback.strip():
            feedback = (f'La puntuación ({score}) no alcanza el mínimo aprobatorio. '
                        'Revisa los criterios y vuelve a entregar.')
        resp = self._review_response(
            review.decide, sub.pk, request.user, decision,
            feedback=feedback, score=score,
            criteria_scores=request.data.get('criteria_scores'),
        )
        if resp.status_code == 200:
            resp.data['message'] = 'Entrega calificada exitosamente'
        return resp

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
        Crea estructura de carpetas consistente con el resto del sistema:
        [Año]/[Proyecto]/[Tarea]/[Estudiante]/Entrega_v[N]

        Esta ruta es idéntica a la usada por upload_document y list_folders_for_project,
        lo que garantiza que los archivos sean visibles en el explorador de Drive.
        """
        try:
            date = submission.created_at
            current_year = date.strftime('%Y')

            # Level 1 - Year folder (root of the institutional structure)
            year_id = drive_service._get_or_create_folder(
                current_year,
                parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
            )

            # Level 2 - Project folder
            if task.project:
                project_name = task.project.name
            else:
                project_name = "General"
            project_folder_id = drive_service._get_or_create_folder(project_name, parent_id=year_id)

            # Level 3 - Task folder (using actual task title, consistent with upload_document)
            task_folder_id = drive_service._get_or_create_folder(task.title, parent_id=project_folder_id)

            # Level 4 - Student folder
            student_name = user.get_full_name() or user.username
            student_folder_id = drive_service._get_or_create_folder(student_name, parent_id=task_folder_id)

            # Level 5 - Version folder
            version_folder = f"Entrega_v{submission.version}"
            version_id = drive_service._get_or_create_folder(version_folder, parent_id=student_folder_id)

            logger.info(
                f"📁 [Drive] Estructura creada: {current_year}/{project_name}/{task.title}"
                f"/{student_name}/{version_folder}"
            )
            return version_id

        except Exception as e:
            logger.error(f"❌ [Drive] Error al crear estructura de carpetas: {e}")
            # Fallback: upload directly to root folder
            try:
                date = submission.created_at
                current_year = date.strftime('%Y')
                year_id = drive_service._get_or_create_folder(
                    current_year,
                    parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
                )
                return drive_service._get_or_create_folder("Entregas de Tareas", parent_id=year_id)
            except Exception:
                return settings.GOOGLE_DRIVE_ROOT_FOLDER_ID

    def _get_mime_type(self, filename):
        """
        Determina el MIME type basado en la extensión del archivo
        """
        mime_type, _ = mimetypes.guess_type(filename)
        return mime_type or 'application/octet-stream'