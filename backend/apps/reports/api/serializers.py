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
    
    # [RENDIMIENTO] Usa los conteos anotados por with_project_stats() (1 query
    # para toda la lista); si no vienen anotados, cae a contar por proyecto.
    def _tasks_total(self, obj):
        value = getattr(obj, 'stats_tasks_total', None)
        return value if value is not None else obj.tasks.count()

    def get_progress(self, obj):
        total_tasks = self._tasks_total(obj)
        if total_tasks == 0:
            return 0
        completed_tasks = getattr(obj, 'stats_tasks_completed', None)
        if completed_tasks is None:
            completed_tasks = obj.tasks.filter(status=Task.TaskStatus.COMPLETED).count()
        return int((completed_tasks / total_tasks) * 100)
    
    def get_member_count(self, obj):
        value = getattr(obj, 'stats_members_total', None)
        return value if value is not None else obj.members.count()
    
    def get_tasks_count(self, obj):
        return self._tasks_total(obj)


def with_project_stats(queryset):
    """Anota los conteos que usa ProjectStatusSerializer."""
    from django.db.models import Count, Q
    # Re-filtrar por pk evita que un filter(members=...) previo distorsione
    # Count('members') (Django reutilizaría ese mismo JOIN).
    base = queryset.model.objects.filter(pk__in=queryset.values('pk'))
    return base.annotate(
        stats_tasks_total=Count('tasks', distinct=True),
        stats_tasks_completed=Count('tasks', filter=Q(tasks__status=Task.TaskStatus.COMPLETED), distinct=True),
        stats_members_total=Count('members', distinct=True),
    )

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