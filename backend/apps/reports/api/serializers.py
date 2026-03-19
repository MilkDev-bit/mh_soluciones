from rest_framework import serializers
from apps.projects.models import Project
from apps.tasks.models import Task
from apps.authentication.models import CustomUser

class ProjectStatusSerializer(serializers.ModelSerializer):
    """Serializador para mostrar un resumen del estado de un proyecto."""
    status_display = serializers.CharField(source='get_status_display')
    progress = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    tasks_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Project
        fields = ['id', 'name', 'status', 'status_display', 'progress', 'member_count', 'tasks_count']
    
    def get_progress(self, obj):
        total_tasks = obj.tasks.count()
        if total_tasks == 0:
            return 0
        completed_tasks = obj.tasks.filter(status=Task.TaskStatus.COMPLETED).count()
        return int((completed_tasks / total_tasks) * 100)
    
    def get_member_count(self, obj):
        return obj.members.count()
    
    def get_tasks_count(self, obj):
        return obj.tasks.count()

class TaskSummarySerializer(serializers.ModelSerializer):
    """Serializador para mostrar un resumen de una tarea."""
    project_name = serializers.CharField(source='project.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = Task
        fields = ['id', 'title', 'project', 'project_name', 'due_date', 'status', 'status_display']

class UserActivitySerializer(serializers.ModelSerializer):
    """Serializador para mostrar la actividad reciente de un usuario."""
    class Meta:
        model = CustomUser
        fields = ['id', 'first_name', 'last_name', 'last_activity']

class SearchResultSerializer(serializers.Serializer):
    """
    Un serializador genérico para representar cualquier tipo de resultado de búsqueda.
    """
    id = serializers.IntegerField()
    name = serializers.CharField()
    type = serializers.CharField()
    url = serializers.CharField()
    details = serializers.CharField()