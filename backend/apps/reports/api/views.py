from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone

from apps.projects.models import Project
from apps.tasks.models import Task
from apps.authentication.models import CustomUser
from .serializers import SearchResultSerializer

class DashboardDataAPIView(APIView):
    """
    Vista de API que devuelve datos agregados para el dashboard principal.
    Los datos se personalizan según el rol del usuario que realiza la petición.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        data = {}

        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            data = self._get_admin_dashboard_data()
        elif user.role in ['DIRECTOR', 'PROFESSOR']:
            data = self._get_manager_dashboard_data(user)
        elif user.role == 'STUDENT':
            data = self._get_student_dashboard_data(user)
        elif user.role == 'CLIENT':
            data = self._get_client_dashboard_data(user)
        
        return Response(data)

    def _get_admin_dashboard_data(self):
        """Genera datos para los roles de alta gerencia."""
        total_projects = Project.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).exclude(role='CLIENT').count()
        completed_tasks_month = Task.objects.filter(
            status='COMPLETED',
            updated_at__month=timezone.now().month
        ).count()
        
        return {
            'total_projects': total_projects,
            'active_users': active_users,
            'completed_tasks_this_month': completed_tasks_month,
            'projects_in_progress': Project.objects.filter(status='IN_PROGRESS').count(),
        }

    def _get_manager_dashboard_data(self, user):
        """Genera datos para Directores y Profesores."""
        user_projects = Project.objects.filter(members=user)
        team_members_ids = user_projects.values_list('members__id', flat=True).distinct()

        tasks = Task.objects.filter(project__in=user_projects)
        
        return {
            'my_projects_count': user_projects.count(),
            'team_members_count': len(team_members_ids),
            'team_pending_tasks': tasks.filter(status='PENDING').count(),
            'team_completed_tasks': tasks.filter(status='COMPLETED').count(),
        }

    def _get_student_dashboard_data(self, user):
        """Genera datos para el rol de Alumno/Empleado."""
        my_tasks = Task.objects.filter(assigned_to=user)
        
        return {
            'assigned_tasks': my_tasks.count(),
            'pending_tasks': my_tasks.filter(status='PENDING').count(),
            'completed_tasks': my_tasks.filter(status='COMPLETED').count(),
            'overdue_tasks': my_tasks.filter(
                due_date__lt=timezone.now().date(),
                status__in=['PENDING', 'IN_PROGRESS']
            ).count(),
        }
    
    def _get_client_dashboard_data(self, user):
        """Genera datos para el rol de Cliente."""
        client_projects = Project.objects.filter(client=user)
        
        project_data = []
        for project in client_projects:
            total_tasks = project.tasks.count()
            completed_tasks = project.tasks.filter(status='COMPLETED').count()
            progress = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
            project_data.append({
                'id': project.id,
                'name': project.name,
                'status': project.status,
                'progress': round(progress)
            })

        return {
            'active_projects_count': client_projects.filter(status='IN_PROGRESS').count(),
            'projects': project_data,
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
        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
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
        )[:5]
        for task in tasks:
            results.append({
                'id': task.id,
                'name': task.title,
                'type': 'Tarea',
                'url': f'/projects/{task.project.id}',
                'details': f"En proyecto: {task.project.name}"
            })
        
        if user.role in ['SUPERADMIN', 'ADMIN', 'RH']:
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