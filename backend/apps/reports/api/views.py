from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import CustomUser
from apps.projects.models import Project
from apps.tasks.models import Task
from .serializers import (
    SearchResultSerializer, 
    ProjectStatusSerializer, 
    TaskSummarySerializer, 
    UserActivitySerializer
)

# Role constants to avoid repetition
ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')
SEARCH_ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'RH')


class DashboardDataAPIView(APIView):
    """
    Vista de API que devuelve datos agregados y robustos para el dashboard principal.
    Los datos se personalizan según el rol del usuario que realiza la petición.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        data = {}

        role_map = {
            'SUPERADMIN': self._get_admin_dashboard_data,
            'ADMIN': self._get_admin_dashboard_data,
            'CEO': self._get_admin_dashboard_data,
            'RH': self._get_admin_dashboard_data,
            'DIRECTOR': self._get_manager_dashboard_data,
            'PROFESSOR': self._get_manager_dashboard_data,
            'STUDENT': self._get_student_dashboard_data,
            'CLIENT': self._get_client_dashboard_data,
        }

        dashboard_function = role_map.get(user.role)
        if dashboard_function:
            data = dashboard_function(user)
        
        return Response(data)

    def _get_admin_dashboard_data(self, user):
        """Genera datos para los roles de alta gerencia (Admins, CEO, RH)."""
        
        total_projects = Project.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).exclude(role='CLIENT').count()
        completed_tasks_month = Task.objects.filter(
            status=Task.TaskStatus.COMPLETED,
            updated_at__month=timezone.now().month
        ).count()
        projects_in_progress = Project.objects.filter(status=Project.ProjectStatus.IN_PROGRESS).count()

        project_status_distribution = Project.objects.values('status').annotate(
            count=Count('id')
        ).order_by('status')

        recent_tasks = Task.objects.order_by('-created_at')[:5]
        
        recent_projects = Project.objects.order_by('-created_at')[:5]

        return {
            'kpis': {
                'total_projects': total_projects,
                'active_users': active_users,
                'completed_tasks_this_month': completed_tasks_month,
                'projects_in_progress': projects_in_progress,
            },
            'charts': {
                'project_status_distribution': list(project_status_distribution),
            },
            'recent_activity': {
                'tasks': TaskSummarySerializer(recent_tasks, many=True).data,
                'projects': ProjectStatusSerializer(recent_projects, many=True).data,
            }
        }

    def _get_manager_dashboard_data(self, user):
        """Genera datos para Directores y Profesores."""
        user_projects = Project.objects.filter(members=user)
        team_members_ids = user_projects.values_list('members__id', flat=True).distinct()
        tasks = Task.objects.filter(project__in=user_projects)
        
        return {
            'kpis': {
                'my_projects_count': user_projects.count(),
                'team_members_count': len(team_members_ids),
                'team_pending_tasks': tasks.filter(status=Task.TaskStatus.PENDING).count(),
                'team_completed_tasks': tasks.filter(status=Task.TaskStatus.COMPLETED).count(),
            },
            'projects_summary': ProjectStatusSerializer(user_projects[:10], many=True).data,
            'upcoming_deadlines': TaskSummarySerializer(
                tasks.filter(due_date__gte=timezone.now(), due_date__lte=timezone.now() + timedelta(days=7)).order_by('due_date'),
                many=True
            ).data,
        }

    def _get_student_dashboard_data(self, user):
        """Genera datos para el rol de Alumno/Empleado."""
        my_tasks = Task.objects.filter(assigned_to=user)
        
        return {
            'kpis': {
                'assigned_tasks': my_tasks.count(),
                'pending_tasks': my_tasks.filter(status=Task.TaskStatus.PENDING).count(),
                'completed_tasks': my_tasks.filter(status=Task.TaskStatus.COMPLETED).count(),
                'overdue_tasks': my_tasks.filter(
                    due_date__lt=timezone.now().date(),
                    status__in=[Task.TaskStatus.PENDING, Task.TaskStatus.IN_PROGRESS]
                ).count(),
            },
            'my_pending_tasks': TaskSummarySerializer(
                my_tasks.filter(status__in=[Task.TaskStatus.PENDING, Task.TaskStatus.IN_PROGRESS]).order_by('due_date')[:10],
                many=True
            ).data,
        }
    
    def _get_client_dashboard_data(self, user):
        """Genera datos para el rol de Cliente."""
        client_projects = Project.objects.filter(client=user)
        
        return {
            'kpis': {
                'active_projects_count': client_projects.filter(status=Project.ProjectStatus.IN_PROGRESS).count(),
                'completed_projects_count': client_projects.filter(status=Project.ProjectStatus.COMPLETED).count(),
            },
            'projects_summary': ProjectStatusSerializer(client_projects, many=True).data,
        }


class GlobalSearchAPIView(APIView):
    """
    Vista de API para una búsqueda global a través de Proyectos, Tareas y Usuarios.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = SearchResultSerializer

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', '')
        user = request.user
        results = []

        if not query or len(query) < 3:
            return Response({"error": "La búsqueda requiere al menos 3 caracteres."}, status=400)

        allowed_projects_qs = Project.objects.none()
        if user.role in ADMIN_ROLES:
            allowed_projects_qs = Project.objects.all()
        elif user.role == 'CLIENT':
            allowed_projects_qs = Project.objects.filter(client=user)
        else:
            allowed_projects_qs = user.projects.all()
        
        projects = allowed_projects_qs.filter(
            Q(name__icontains=query) | Q(description__icontains=query)
        )[:5]
        for project in projects:
            results.append({
                'id': project.id,
                'name': project.name,
                'type': 'Proyecto',
                'url': f'/projects/{project.id}',
                'details': project.get_status_display()
            })

        tasks = Task.objects.filter(project__in=allowed_projects_qs).filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related('project')[:5]
        for task in tasks:
            results.append({
                'id': task.id,
                'name': task.title,
                'type': 'Tarea',
                'url': f'/projects/{task.project.id}',
                'details': f"En proyecto: {task.project.name}"
            })
        
        if user.role in SEARCH_ADMIN_ROLES:
            users = CustomUser.objects.filter(is_active=True).filter(
                Q(username__icontains=query) | Q(first_name__icontains=query) | Q(last_name__icontains=query)
            )[:5]
            for found_user in users:
                results.append({
                    'id': found_user.id,
                    'name': found_user.get_full_name() or found_user.username,
                    'type': 'Usuario',
                    'url': f'/profile/{found_user.id}',
                    'details': found_user.email
                })

        serializer = self.serializer_class(instance=results, many=True)
        return Response(serializer.data)