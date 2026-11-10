import logging

from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.authentication.api.serializers import UserSerializer
from apps.core.permissions import TEACHER_ROLES
from apps.projects.api.serializers import ProjectSerializer
from apps.documents.api.serializers import DocumentSerializer
from ..models import Task, TaskSubmission, TaskComment, TaskEditHistory, TaskReopenLog

logger = logging.getLogger(__name__)

from .. import deadlines


class ReviewerMiniSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class TaskCommentSerializer(serializers.ModelSerializer):
    """ Serializador para los comentarios de las tareas. """
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = TaskComment
        fields = ['id', 'task', 'user', 'comment', 'created_at']
        read_only_fields = ('id', 'task', 'user', 'created_at')


class TaskSubmissionSerializer(serializers.ModelSerializer):
    """ Serializador para las entregas de tareas. """
    submitted_by = UserSerializer(read_only=True)
    graded_by_user = UserSerializer(source='graded_by', read_only=True)
    reviewer_user = ReviewerMiniSerializer(source='reviewer', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    documents = DocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = TaskSubmission
        fields = [
            'id', 'task', 'submitted_by', 'notes', 'file', 'link', 
            'correction_notes', 'is_approved', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive',
            'version', 'status', 'status_display', 'is_late', 'score', 'teacher_feedback',
            'graded_by', 'graded_by_user', 'graded_at', 'criteria_scores', 'files_metadata',
            'reviewer_user', 'review_started_at', 'documents'
        ]
        # Todo lo relacionado con la revisión es de solo lectura: antes un alumno
        # podía hacer PATCH de su propia entrega con status=GRADED o score=100.
        read_only_fields = [
            'id', 'task', 'submitted_by', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive',
            'version', 'status', 'status_display', 'is_late', 'score', 'teacher_feedback',
            'graded_by', 'graded_by_user', 'graded_at', 'criteria_scores', 'is_approved',
            'correction_notes', 'reviewer_user', 'review_started_at', 'documents'
        ]


class TaskSubmissionGradeSerializer(serializers.ModelSerializer):
    """ Serializador para calificar entregas de tareas. """
    
    decision = serializers.ChoiceField(choices=['approve', 'request_changes'], required=False,
                                       write_only=True)

    class Meta:
        model = TaskSubmission
        fields = ['score', 'teacher_feedback', 'criteria_scores', 'status', 'decision']
    
    def validate_score(self, value):
        task = self.instance.task if self.instance else None
        if task and value is not None:
            if value < 0 or value > task.max_score:
                raise serializers.ValidationError(
                    f"La puntuación debe estar entre 0 y {task.max_score}"
                )
        return value
    
    def validate(self, data):
        user = self.context['request'].user
        if user.role not in TEACHER_ROLES:
            raise serializers.ValidationError(
                "No tienes permisos para calificar entregas."
            )
        return data


class TaskEditHistorySerializer(serializers.ModelSerializer):
    """ Serializador para el historial de ediciones. """
    edited_by_user = UserSerializer(source='edited_by', read_only=True)
    
    class Meta:
        model = TaskEditHistory
        fields = ['id', 'task', 'edited_by', 'edited_by_user', 'changes', 
                  'edit_reason', 'created_at']
        read_only_fields = ['id', 'task', 'edited_by', 'edited_by_user', 'created_at']


class TaskReopenLogSerializer(serializers.ModelSerializer):
    """ Serializador para los registros de reapertura. """
    reopened_by_user = UserSerializer(source='reopened_by', read_only=True)
    specific_students_data = UserSerializer(source='specific_students', many=True, read_only=True)
    
    class Meta:
        model = TaskReopenLog
        fields = ['id', 'task', 'reopened_by', 'reopened_by_user', 'new_deadline',
                  'reason', 'specific_students', 'specific_students_data', 'created_at']
        read_only_fields = ['id', 'task', 'reopened_by', 'reopened_by_user', 'created_at']


class TaskSerializer(serializers.ModelSerializer):
    """ Serializador para la vista de lista de tareas. """
    assigned_to = UserSerializer(read_only=True)
    assigned_students_data = UserSerializer(source='assigned_students', many=True, read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    has_attachment = serializers.SerializerMethodField()
    submissions_count = serializers.SerializerMethodField()
    last_submission_date = serializers.SerializerMethodField()
    pending_review_count = serializers.SerializerMethodField()
    # [NUEVO] Fechas calculadas por el servidor: el frontend ya no decide si vence.
    deadline = serializers.SerializerMethodField()
    late_deadline = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    my_window = serializers.SerializerMethodField()
    my_submission_status = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'status_display', 'priority', 
            'priority_display', 'due_date', 'assigned_to', 'project', 'project_name',
            'open_date', 'close_date', 'max_score', 'assigned_students', 
            'assigned_students_data', 'allow_late_submissions', 'accept_after_close',
            'days_after_close', 'is_continuous',
            'deadline', 'late_deadline', 'is_overdue', 'my_window', 'my_submission_status',
            'created_at', 'updated_at', 'has_attachment', 'submissions_count',
            'last_submission_date', 'pending_review_count'
        ]

    def get_has_attachment(self, obj):
        return bool(obj.attachment)

    # Los conteos usan anotaciones de get_queryset (antes: 2 queries por tarea)
    def get_submissions_count(self, obj):
        value = getattr(obj, 'submissions_total', None)
        return value if value is not None else obj.submissions.count()

    def get_last_submission_date(self, obj):
        value = getattr(obj, 'last_submission_at', None)
        if value is None and not hasattr(obj, 'last_submission_at'):
            last_sub = obj.submissions.order_by('-created_at').first()
            value = last_sub.created_at if last_sub else None
        return value.isoformat() if value else None

    def get_pending_review_count(self, obj):
        return getattr(obj, 'pending_review_total', None)

    def get_deadline(self, obj):
        dl = deadlines.task_deadline(obj)
        return dl.isoformat() if dl else None

    def get_late_deadline(self, obj):
        dl = deadlines.late_deadline_for(obj, deadlines.task_deadline(obj))
        return dl.isoformat() if dl else None

    def get_is_overdue(self, obj):
        dl = deadlines.task_deadline(obj)
        return bool(dl and timezone.now() > dl and obj.status not in ('CLOSED', 'COMPLETED'))

    def _student(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated or user.role in TEACHER_ROLES:
            return None
        return user

    def _assigned_student(self, obj):
        """El usuario actual solo si es alumno ASIGNADO a esta tarea.

        Las tareas de otros (o generales del proyecto) no tienen plazo para él,
        así que no deben aparecer como pendientes ni vencidas en su tablero.
        """
        user = self._student()
        if user is None:
            return None
        if obj.assigned_to_id == user.pk or any(s.pk == user.pk for s in obj.assigned_students.all()):
            return user
        return None

    def get_my_window(self, obj):
        """Ventana de entrega del usuario actual (solo alumnos asignados)."""
        user = self._assigned_student(obj)
        if user is None:
            return None
        latest = deadlines.latest_submission_for(obj, user)
        return deadlines.submission_window(obj, user, latest_submission=latest).as_dict()

    def get_my_submission_status(self, obj):
        user = self._assigned_student(obj)
        if user is None:
            return None
        latest = deadlines.latest_submission_for(obj, user)
        return latest.status if latest else None


class TaskDetailSerializer(TaskSerializer):
    """ Serializador para la vista de detalle de una tarea. """
    created_by = UserSerializer(read_only=True)
    project = ProjectSerializer(read_only=True)
    submissions = TaskSubmissionSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    edit_history = TaskEditHistorySerializer(many=True, read_only=True)
    reopen_logs = TaskReopenLogSerializer(many=True, read_only=True)
    
    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + [
            'created_by', 'submissions', 'comments', 
            'grading_criteria', 'attachment',
            'edit_history', 'reopen_logs'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # [FIX privacidad] Un alumno veía las entregas y calificaciones de todos
        # sus compañeros en el detalle de la tarea. Ahora solo ve las suyas.
        user = self._student()
        if user is not None:
            data['submissions'] = [s for s in data.get('submissions', [])
                                   if (s.get('submitted_by') or {}).get('id') == user.pk]
        return data


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    """ Serializador para crear y actualizar tareas. """
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'project', 'assigned_to', 
            'status', 'priority', 'due_date', 'open_date', 'close_date',
            'max_score', 'grading_criteria', 'attachment', 'assigned_students',
            'allow_late_submissions', 'accept_after_close', 'days_after_close',
            'is_continuous'
        ]

    def validate_days_after_close(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Los días de gracia no pueden ser negativos.')
        return value
    
    def validate(self, data):
        user = self.context['request'].user
        if self.instance is None:
            if user.role not in TEACHER_ROLES:
                raise serializers.ValidationError(
                    "No tienes permisos para crear tareas."
                )
        else:
            if user.role not in TEACHER_ROLES:
                task = self.instance
                is_assigned = user == task.assigned_to or task.assigned_students.filter(id=user.id).exists()
                is_member = task.project and task.project.projectmember_set.filter(user=user).exists()
                if not (is_assigned or is_member or user == task.created_by):
                    raise serializers.ValidationError(
                        "No tienes permisos para editar esta tarea."
                    )
        
        # Validate dates
        open_date = data.get('open_date', getattr(self.instance, 'open_date', None))
        close_date = data.get('close_date', getattr(self.instance, 'close_date', None))
        
        if open_date and close_date and close_date <= open_date:
            raise serializers.ValidationError({
                "non_field_errors": ["La fecha de cierre debe ser posterior a la fecha de apertura."]
            })

        # [FIX zona horaria] due_date y close_date describían el mismo vencimiento
        # pero podían apuntar a días distintos (close_date en UTC). Si hay
        # close_date, due_date se deriva de su fecha LOCAL para que coincidan.
        if data.get('close_date'):
            data['due_date'] = timezone.localtime(data['close_date']).date()
        
        # GRAFICAS es una actividad permanente: continua por defecto al crearla.
        if self.instance is None and 'is_continuous' not in self.initial_data:
            title = (data.get('title') or '').strip().lower()
            if title in ('graficas', 'gráficas'):
                data['is_continuous'] = True

        # Ensure assigned_students exists (empty list by default only on create)
        if self.instance is None and 'assigned_students' not in data:
            data['assigned_students'] = []
        
        return data


class TaskReopenSerializer(serializers.Serializer):
    """
    Reabrir o dar prórroga.

    - Con `specific_students`: prórroga solo para esos alumnos (no cambia la
      fecha de los demás). Antes se ignoraba y se movía la fecha de todos.
    - Sin alumnos: nueva fecha límite general.
    - `days` permite "N días más a partir de hoy" sin elegir fecha y hora.
    """
    new_deadline = serializers.DateTimeField(required=False)
    days = serializers.IntegerField(required=False, min_value=1, max_value=60)
    reason = serializers.CharField(required=False, allow_blank=True)
    specific_students = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True
    )
    
    def validate(self, data):
        user = self.context['request'].user
        if user.role not in TEACHER_ROLES:
            raise serializers.ValidationError(
                "No tienes permisos para reabrir tareas."
            )
        if not data.get('new_deadline') and not data.get('days'):
            raise serializers.ValidationError(
                "Indica la nueva fecha límite o el número de días de prórroga."
            )
        if not data.get('new_deadline'):
            data['new_deadline'] = deadlines.end_of_local_day(
                timezone.localdate() + timedelta(days=data['days'])
            )
        if data['new_deadline'] <= timezone.now():
            raise serializers.ValidationError("La nueva fecha límite debe ser futura.")
        return data