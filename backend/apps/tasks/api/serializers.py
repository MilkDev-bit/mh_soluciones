from rest_framework import serializers
from ..models import Task, TaskSubmission, TaskComment
from apps.authentication.api.serializers import UserSerializer
from apps.projects.api.serializers import ProjectSerializer

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
    
    class Meta:
        model = TaskSubmission
        fields = [
            'id', 'task', 'submitted_by', 'notes', 'file', 'link', 
            'correction_notes', 'is_approved', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive'
        ]
        read_only_fields = [
            'id', 'task', 'submitted_by', 'created_at', 'updated_at',
            'google_drive_file_id', 'google_drive_link', 'uploaded_to_drive'
        ]


class TaskSerializer(serializers.ModelSerializer):
    """ Serializador para la vista de lista de tareas. """
    assigned_to = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    
    class Meta:
        model = Task
        fields = [
            'id', 'title', 'status', 'status_display', 'priority', 
            'priority_display', 'due_date', 'assigned_to', 'project', 'project_name'
        ]


class TaskDetailSerializer(TaskSerializer):
    """ Serializador para la vista de detalle de una tarea. """
    created_by = UserSerializer(read_only=True)
    project = ProjectSerializer(read_only=True)
    submissions = TaskSubmissionSerializer(many=True, read_only=True)
    comments = TaskCommentSerializer(many=True, read_only=True)
    
    class Meta(TaskSerializer.Meta):
        fields = TaskSerializer.Meta.fields + [
            'description', 'created_by', 'submissions', 'comments', 
            'created_at', 'updated_at'
        ]


class TaskCreateUpdateSerializer(serializers.ModelSerializer):
    """ Serializador para crear y actualizar tareas. """
    
    class Meta:
        model = Task
        fields = [
            'title', 'description', 'project', 'assigned_to', 
            'status', 'priority', 'due_date'
        ]
    
    def validate(self, data):
        user = self.context['request'].user
        if user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            raise serializers.ValidationError("No tienes permisos para crear o editar tareas.")
        return data