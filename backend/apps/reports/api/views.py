from datetime import date, datetime, time, timedelta
from django.db.models import Count, Q, Avg, F, ExpressionWrapper, fields
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.authentication.models import CustomUser
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task
from .serializers import (
    with_project_stats,
    SearchResultSerializer, 
    ProjectStatusSerializer, 
    TaskSummarySerializer, 
    UserActivitySerializer
)

ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')
FULL_ACCESS_ROLES = ('SUPERADMIN', 'CEO', 'RH')
SEARCH_ADMIN_ROLES = ('SUPERADMIN', 'ADMIN', 'RH')


def get_admin_accessible_projects(user):
    """Returns a queryset of projects accessible to an ADMIN user (member or creator)."""
    project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
    return Project.objects.filter(
        Q(id__in=project_ids) | Q(created_by=user)
    ).distinct()



def iso_week_trend(tasks_qs, today, count=4):
    """
    Tareas completadas por semana ISO 8601 (lunes a domingo en hora local)
    para las últimas `count` semanas, incluida la actual.
    Devuelve (valores, etiquetas) en orden cronológico; etiqueta "SEM 46 · 2026".
    """
    tz = timezone.get_current_timezone()
    monday = today - timedelta(days=today.weekday())
    aggregates, labels = {}, []
    for i in range(count - 1, -1, -1):
        start_day = monday - timedelta(weeks=i)
        start = timezone.make_aware(datetime.combine(start_day, time.min), tz)
        end = start + timedelta(weeks=1)
        iso_year, iso_week, _ = start_day.isocalendar()
        key = f'w{i}'
        aggregates[key] = Count('id', filter=Q(status='COMPLETED', updated_at__gte=start, updated_at__lt=end))
        labels.append((key, f'SEM {iso_week} · {iso_year}'))
    stats = tasks_qs.aggregate(**aggregates)
    return [stats[k] for k, _ in labels], [label for _, label in labels]

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
            status__in=[Task.TaskStatus.COMPLETED, Task.TaskStatus.CLOSED],
            updated_at__month=timezone.now().month
        ).count()
        projects_in_progress = Project.objects.filter(status=Project.ProjectStatus.IN_PROGRESS).count()

        project_status_distribution = Project.objects.values('status').annotate(
            count=Count('id')
        ).order_by('status')

        recent_tasks = Task.objects.order_by('-created_at')[:5]
        
        recent_projects = with_project_stats(Project.objects.all()).order_by('-created_at')[:5]

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
        user_projects = get_admin_accessible_projects(user)

        total_projects = user_projects.count()
        completed_tasks_month = Task.objects.filter(
            project__in=user_projects,
            status__in=[Task.TaskStatus.COMPLETED, Task.TaskStatus.CLOSED],
            updated_at__month=timezone.now().month
        ).count()
        projects_in_progress = user_projects.filter(status=Project.ProjectStatus.IN_PROGRESS).count()
        # active_users reflects all system users (global context, not scoped to projects)
        active_users = CustomUser.objects.filter(is_active=True).exclude(role='CLIENT').count()

        project_status_distribution = user_projects.values('status').annotate(
            count=Count('id')
        ).order_by('status')

        recent_tasks = Task.objects.filter(project__in=user_projects).order_by('-created_at')[:5]
        recent_projects = with_project_stats(user_projects).order_by('-created_at')[:5]

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
                'team_pending_tasks': tasks.filter(status__in=[
                    Task.TaskStatus.OPEN, Task.TaskStatus.REOPENED,
                    Task.TaskStatus.IN_REVIEW, Task.TaskStatus.FOR_REVIEW,
                    Task.TaskStatus.PENDING, Task.TaskStatus.IN_PROGRESS,
                ]).count(),
                'team_completed_tasks': tasks.filter(status__in=[
                    Task.TaskStatus.COMPLETED, Task.TaskStatus.CLOSED,
                ]).count(),
            },
            'projects_summary': ProjectStatusSerializer(with_project_stats(user_projects)[:10], many=True).data,
            'upcoming_deadlines': TaskSummarySerializer(
                tasks.filter(due_date__gte=timezone.localdate(), due_date__lte=timezone.localdate() + timedelta(days=7)).order_by('due_date'),
                many=True
            ).data,
        }

    def _get_student_dashboard_data(self, user):
        """
        Panel del Alumno/Empleado.

        [FIX] Antes los indicadores y "Mis Tareas Pendientes" se calculaban con el
        estado GLOBAL de la tarea: una tarea seguía "pendiente" aunque el alumno
        ya la hubiera entregado (o aprobado), las tareas viejas de semanas
        anteriores nunca salían de la lista y "Vencidas" contaba cualquier
        due_date pasada. Ahora se usa la misma regla que Mis Tareas
        (apps.tasks.deadlines.classify_user_tasks): entrega del alumno + plazo.
        """
        from apps.tasks import deadlines

        buckets = deadlines.classify_user_tasks(user)
        actionable = buckets['changes_requested'] + buckets['late'] + buckets['to_submit']

        def summary(task, window):
            data = TaskSummarySerializer(task).data
            data.update({
                'deadline': window.deadline.isoformat() if window.deadline else None,
                'is_continuous': task.is_continuous,
                'window_state': window.state,
                'window_message': window.message,
            })
            return data

        return {
            'kpis': {
                'assigned_tasks': sum(len(v) for v in buckets.values()),
                # Lo que el alumno todavía puede (y debe) entregar
                'pending_tasks': len(actionable),
                # Entregadas (en revisión) + aprobadas
                'completed_tasks': len(buckets['submitted']) + len(buckets['graded']),
                # Vencidas sin entrega y sin posibilidad de entregar tarde
                'overdue_tasks': len(buckets['overdue']),
            },
            'my_pending_tasks': [summary(t, w) for t, w in actionable[:10]],
        }
    
    def _get_client_dashboard_data(self, user):
        """Genera datos para el rol de Cliente."""
        # Incluir proyectos donde el usuario es el cliente FK o es miembro del proyecto
        client_project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
        client_projects = Project.objects.filter(
            Q(client=user) | Q(id__in=client_project_ids)
        ).distinct()
        
        return {
            'kpis': {
                'active_projects_count': client_projects.filter(status=Project.ProjectStatus.IN_PROGRESS).count(),
                'completed_projects_count': client_projects.filter(status=Project.ProjectStatus.COMPLETED).count(),
            },
            'projects_summary': ProjectStatusSerializer(with_project_stats(client_projects), many=True).data,
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
        today = timezone.localdate()  # [FIX] fecha local, no UTC
        
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
            projects_qs = get_admin_accessible_projects(user)
            tasks_qs = tasks_qs.filter(project__in=projects_qs)
        elif user.role not in FULL_ACCESS_ROLES:
            if user.role == 'CLIENT':
                client_project_ids = ProjectMember.objects.filter(user=user).values_list('project_id', flat=True)
                projects_qs = projects_qs.filter(
                    Q(client=user) | Q(id__in=client_project_ids)
                ).distinct()
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
            vencidas=Count('id', filter=Q(due_date__lt=today, is_continuous=False,
                                          status__in=['PENDING', 'IN_PROGRESS', 'OPEN', 'REOPENED', 'IN_REVIEW', 'FOR_REVIEW'])),
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
        proyectos_detalle = []
        if not proyecto_id:
            proyectos_data = tasks_qs.values('project__name').annotate(task_count=Count('id')).filter(task_count__gt=0).order_by('-task_count')
            project_task_counts = [{'project_name': p['project__name'], 'task_count': p['task_count']} for p in proyectos_data]
            
            tasks_by_project = {}
            for t in tasks_qs.values('project_id', 'status', 'due_date'):
                pid = t['project_id']
                if not pid:
                    continue
                if pid not in tasks_by_project:
                    tasks_by_project[pid] = {'total': 0, 'completed': 0, 'overdue': 0}
                
                tasks_by_project[pid]['total'] += 1
                status = t['status']
                due_date = t['due_date']
                
                if status == 'COMPLETED':
                    tasks_by_project[pid]['completed'] += 1
                elif status in ['PENDING', 'IN_PROGRESS', 'OPEN', 'IN_REVIEW', 'FOR_REVIEW'] and due_date and due_date < today:
                    tasks_by_project[pid]['overdue'] += 1

            for p in projects_qs:
                stats = tasks_by_project.get(p.id, {'total': 0, 'completed': 0, 'overdue': 0})
                t_total = stats['total']
                t_completadas = stats['completed']
                t_vencidas = stats['overdue']
                
                duracion_dias = 0
                if p.start_date and p.end_date:
                    duracion_dias = max(1, (p.end_date - p.start_date).days)
                elif p.status == 'COMPLETED' and p.start_date:
                    duracion_dias = max(1, (today - p.start_date).days)
                elif p.status == 'COMPLETED' and p.created_at:
                    duracion_dias = max(1, (today - p.created_at.date()).days)
                elif p.start_date:
                    duracion_dias = max(1, (today - p.start_date).days)
                elif p.created_at:
                    duracion_dias = max(1, (today - p.created_at.date()).days)
                    
                promedio_cri = 100
                if t_total > 0:
                    score = ((t_completadas - (t_vencidas * 0.25)) / t_total) * 100
                    promedio_cri = max(0, min(100, int(round(score))))
                elif p.status == 'COMPLETED':
                    promedio_cri = 100
                else:
                    promedio_cri = 0
                    
                proyectos_detalle.append({
                    'id': p.id,
                    'name': p.name,
                    'status': p.status,
                    'start_date': p.start_date.isoformat() if p.start_date else (p.created_at.date().isoformat() if p.created_at else None),
                    'end_date': p.end_date.isoformat() if p.end_date else None,
                    'created_at': p.created_at.isoformat() if p.created_at else None,
                    'total_entregas': t_total,
                    'terminadas': t_completadas,
                    'vencidas': t_vencidas,
                    'duracion_dias': duracion_dias,
                    'calificacion_cri': promedio_cri
                })

        # [CAMBIO] Tendencia por semanas ISO 8601 (lunes a domingo, hora
        # local): las últimas 4 semanas incluyendo la actual. Antes eran
        # ventanas de 7 días contadas hacia atrás desde "ahora".
        weekly_data, weekly_labels = iso_week_trend(tasks_qs, today, count=4)

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
            'tendenciaSemanalEtiquetas': weekly_labels,
            'tareasPorProyecto': project_task_counts,
            'proyectosDetalle': proyectos_detalle,
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
        if user.role == 'ADMIN':
            allowed_projects_qs = get_admin_accessible_projects(user)
        elif user.role in FULL_ACCESS_ROLES:
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


class EntregablesReportAPIView(APIView):
    """
    Descarga el reporte semanal de entregables en Excel
    (mismo formato que "Entregables-Semana-02_al_08_de_Noviembre.xlsx").

    Parámetros: year y week (semana ISO 8601). Por defecto, la semana anterior
    a la actual (la última semana completa).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from django.http import HttpResponse
        from apps.reports.entregables import build_workbook, collect_rows, week_filename

        user = request.user
        if user.role not in ADMIN_ROLES:
            return Response({'detail': 'No tienes permiso para descargar este reporte.'}, status=403)

        default = timezone.localdate() - timedelta(days=7)
        default_year, default_week, _ = default.isocalendar()
        try:
            year = int(request.query_params.get('year', default_year))
            week = int(request.query_params.get('week', default_week))
            date.fromisocalendar(year, week, 1)
        except (TypeError, ValueError):
            return Response({'detail': 'Semana ISO inválida.'}, status=400)

        projects_qs = Project.objects.filter(es_archivado=False)
        if user.role == 'ADMIN':
            projects_qs = projects_qs.filter(id__in=get_admin_accessible_projects(user).values('id'))

        rows = collect_rows(projects_qs, year, week)
        content = build_workbook(rows, year, week)
        filename = week_filename(year, week)
        response = HttpResponse(
            content,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response
