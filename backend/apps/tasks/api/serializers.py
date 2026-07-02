import logging

from rest_framework import serializers

from apps.authentication.api.serializers import UserSerializer
from apps.projects.api.serializers import ProjectSerializer
from apps.documents.api.serializers import DocumentSerializer
from ..models import Task, TaskSubmission, TaskComment, TaskEditHistory, TaskReopenLog

logger = logging.getLogger(__name__)

# Role constants to avoid repetition
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')
TEACHER_ROLES = ADMIN_ROLES + ('PROFESSOR', 'DIRECTOR')


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
    documents = DocumentSerializer(many=True, read_only=True)
    
    class Meta:
        model = TaskSubmission
        fields = [
            'id', 'task', 'submitted_by', 'notes', 'file', 'link', 
            'correction_notes', 'is_approved', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive',
            'version', 'status', 'score', 'teacher_feedback', 'graded_by',
            'graded_by_user', 'graded_at', 'criteria_scores', 'files_metadata',
            'documents'
        ]
        read_only_fields = [
            'id', 'task', 'submitted_by', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive',
            'version', 'graded_by_user', 'documents'
        ]


class TaskSubmissionGradeSerializer(serializers.ModelSerializer):
    """ Serializador para calificar entregas de tareas. """
    
    class Meta:
        model = TaskSubmission
        fields = ['score', 'teacher_feedback', 'criteria_scores', 'status']
    
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

    class Meta:
        model = Task
        fields = [
            'id', 'title', 'description', 'status', 'status_display', 'priority', 
            'priority_display', 'due_date', 'assigned_to', 'project', 'project_name',
            'open_date', 'close_date', 'max_score', 'assigned_students', 
            'assigned_students_data', 'allow_late_submissions', 'accept_after_close',
            'created_at', 'updated_at', 'has_attachment', 'submissions_count', 'last_submission_date'
        ]

    def get_has_attachment(self, obj):
        return bool(obj.attachment)

    def get_submissions_count(self, obj):
        return obj.submissions.count()

    def get_last_submission_date(self, obj):
        last_sub = obj.submissions.order_by('-created_at').first()
        if last_sub:
            return last_sub.created_at.isoformat()
        return None


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
            'days_after_close', 'edit_history', 'reopen_logs'
        ]


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    """ Serializador para crear y actualizar tareas. """
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'project', 'assigned_to', 
            'status', 'priority', 'due_date', 'open_date', 'close_date',
            'max_score', 'grading_criteria', 'attachment', 'assigned_students',
            'allow_late_submissions', 'accept_after_close', 'days_after_close'
        ]
    
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
        
        # Ensure assigned_students exists (empty list by default only on create)
        if self.instance is None and 'assigned_students' not in data:
            data['assigned_students'] = []
        
        return data


class TaskReopenSerializer(serializers.Serializer):
    """ Serializador para reabrir una tarea. """
    new_deadline = serializers.DateTimeField(required=True)
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
        return data