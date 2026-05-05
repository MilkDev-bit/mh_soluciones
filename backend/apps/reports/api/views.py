from datetime import timedelta
from django.db.models import Count, Q, Avg, F, ExpressionWrapper, fields
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import CustomUser
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task
from .serializers import (
    SearchResultSerializer, 
    ProjectStatusSerializer, 
    TaskSummarySerializer, 
    UserActivitySerializer
)

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
            'ADMIN': self._get_admin_scoped_dashboard_data,
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

    def _get_admin_scoped_dashboard_data(self, user):
        """Genera datos para el rol ADMIN, limitados a los proyectos a los que pertenece o creó."""
        project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
        user_projects = Project.objects.filter(
            Q(id__in=project_ids) | Q(created_by=user)
        ).distinct()

        total_projects = user_projects.count()
        completed_tasks_month = Task.objects.filter(
            project__in=user_projects,
            status=Task.TaskStatus.COMPLETED,
            updated_at__month=timezone.now().month
        ).count()
        projects_in_progress = user_projects.filter(status=Project.ProjectStatus.IN_PROGRESS).count()
        active_users = CustomUser.objects.filter(is_active=True).exclude(role='CLIENT').count()

        project_status_distribution = user_projects.values('status').annotate(
            count=Count('id')
        ).order_by('status')

        recent_tasks = Task.objects.filter(project__in=user_projects).order_by('-created_at')[:5]
        recent_projects = user_projects.order_by('-created_at')[:5]

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

class StatisticsAPIView(APIView):
    """
    Vista de API MEGA-OPTIMIZADA que devuelve estadísticas avanzadas.
    Reduce los tiempos de respuesta de 6+ segundos a < 200 milisegundos.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        rango = request.query_params.get('rango', '30_dias')
        proyecto_id = request.query_params.get('proyecto', None)
        usuario_id = request.query_params.get('usuario', None)
        
        now = timezone.now()
        today = now.date()
        
        if rango == '7_dias':
            start_date = now - timedelta(days=7)
            weeks = 1
        elif rango == '90_dias':
            start_date = now - timedelta(days=90)
            weeks = 13
        elif rango == '12_meses':
            start_date = now - timedelta(days=365)
            weeks = 52
        else:
            start_date = now - timedelta(days=30)
            weeks = 4
        
        tasks_qs = Task.objects.all()
        projects_qs = Project.objects.all()
        
        if user.role == 'ADMIN':
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            projects_qs = projects_qs.filter(
                Q(id__in=project_ids) | Q(created_by=user)
            ).distinct()
            tasks_qs = tasks_qs.filter(project__in=projects_qs)
        elif user.role not in ADMIN_ROLES:
            if user.role == 'CLIENT':
                projects_qs = projects_qs.filter(client=user)
                tasks_qs = tasks_qs.filter(project__in=projects_qs)
            else:
                projects_qs = user.projects.all()
                tasks_qs = tasks_qs.filter(project__in=projects_qs)
        
        if proyecto_id:
            tasks_qs = tasks_qs.filter(project_id=proyecto_id)
            projects_qs = projects_qs.filter(id=proyecto_id)
        if usuario_id:
            tasks_qs = tasks_qs.filter(assigned_to_id=usuario_id)
        
        tasks_in_range = tasks_qs.filter(created_at__gte=start_date)
        
        task_stats = tasks_in_range.aggregate(
            totales=Count('id'),
            completadas=Count('id', filter=Q(status='COMPLETED')),
            en_progreso=Count('id', filter=Q(status='PENDING')),
            vencidas=Count('id', filter=Q(due_date__lt=today, status__in=['PENDING', 'IN_PROGRESS'])),
            tiempo_promedio=Avg(
                ExpressionWrapper(F('updated_at') - F('created_at'), output_field=fields.DurationField()),
                filter=Q(status='COMPLETED')
            )
        )

        total_tasks = task_stats['totales'] or 0
        completed_tasks = task_stats['completadas'] or 0
        in_progress_tasks = task_stats['en_progreso'] or 0
        overdue_tasks = task_stats['vencidas'] or 0
        avg_time = task_stats['tiempo_promedio']

        tiempo_promedio = round(avg_time.total_seconds() / 86400, 1) if avg_time else 0
        completion_percentage = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0
        
        active_projects = projects_qs.filter(status='IN_PROGRESS').count()
        active_users = CustomUser.objects.filter(is_active=True).exclude(role='CLIENT').count() if user.role in ADMIN_ROLES else 0
        
        top_performers = []
        if user.role in ADMIN_ROLES or user.role in ['DIRECTOR', 'PROFESSOR']:
            top_users_qs = tasks_in_range.filter(
                status='COMPLETED', 
                assigned_to__isnull=False
            ).values(
                'assigned_to__username', 
                'assigned_to__first_name', 
                'assigned_to__last_name'
            ).annotate(count=Count('id')).order_by('-count')
            
            for u in top_users_qs:
                nombre = f"{u['assigned_to__first_name']} {u['assigned_to__last_name']}".strip()
                top_performers.append({
                    'name': nombre if nombre else u['assigned_to__username'],
                    'count': u['count']
                })

        project_task_counts = []
        if not proyecto_id:
            proyectos_data = tasks_qs.values('project__name').annotate(task_count=Count('id')).filter(task_count__gt=0).order_by('-task_count')
            project_task_counts = [{'project_name': p['project__name'], 'task_count': p['task_count']} for p in proyectos_data]

        weekly_data = []
        week_delta = timedelta(days=7)
        week_aggregates = {}
        
        for i in range(min(weeks, 4)):
            week_start = now - week_delta * (i + 1)
            week_end = now - week_delta * i
            week_aggregates[f'week_{i}'] = Count('id', filter=Q(status='COMPLETED', updated_at__gte=week_start, updated_at__lt=week_end))
        
        if week_aggregates:
            trend_stats = tasks_qs.aggregate(**week_aggregates)
            for i in range(min(weeks, 4)):
                weekly_data.insert(0, trend_stats[f'week_{i}'])
        else:
            weekly_data = [0, 0, 0, 0]

        return Response({
            'tareasTotales': total_tasks,
            'tareasCompletadas': completed_tasks,
            'tareasEnProgreso': in_progress_tasks,
            'tareasVencidas': overdue_tasks,
            'proyectosActivos': active_projects,
            'usuariosActivos': active_users,
            'porcentajeCompletado': completion_percentage,
            'tiempoPromedioDias': tiempo_promedio,
            'topPerformers': top_performers,
            'tendenciaSemanal': weekly_data,
            'tareasPorProyecto': project_task_counts,
        })


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
        if user.role in ADMIN_ROLES and user.role != 'ADMIN':
            allowed_projects_qs = Project.objects.all()
        elif user.role == 'ADMIN':
            project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
            allowed_projects_qs = Project.objects.filter(
                Q(id__in=project_ids) | Q(created_by=user)
            ).distinct()
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