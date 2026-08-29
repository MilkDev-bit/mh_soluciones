"""
Celery tasks for the tasks app
Handles periodic tasks like sending due date reminders
"""
from celery import shared_task
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
import logging

from .models import Task
from utils.email_notifications import send_task_due_reminder

logger = logging.getLogger(__name__)


@shared_task
def send_task_due_reminders():
    """
    Periodic task to send reminders for tasks that are due soon.
    Should be scheduled to run daily.
    Sends reminders for tasks due in 1 day and 3 days.
    """
    now = timezone.now()
    
    # Tasks due in 1 day
    one_day_from_now = now + timedelta(days=1)
    tasks_due_tomorrow = Task.objects.filter(
        due_date__date=one_day_from_now.date(),
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT']
    ).filter(
        Q(assigned_to__isnull=False) | Q(assigned_students__isnull=False)
    ).select_related('project', 'assigned_to').prefetch_related('assigned_students').distinct()
    
    for task in tasks_due_tomorrow:
        try:
            send_task_due_reminder(task)
            logger.info(f"Sent due reminder for task {task.id}: {task.title}")
        except Exception as e:
            logger.error(f"Failed to send reminder for task {task.id}: {str(e)}")
    
    # Tasks due in 3 days
    three_days_from_now = now + timedelta(days=3)
    tasks_due_in_three_days = Task.objects.filter(
        due_date__date=three_days_from_now.date(),
        status__in=['OPEN', 'IN_PROGRESS', 'DRAFT']
    ).filter(
        Q(assigned_to__isnull=False) | Q(assigned_students__isnull=False)
    ).select_related('project', 'assigned_to').prefetch_related('assigned_students').distinct()
    
    for task in tasks_due_in_three_days:
        try:
            send_task_due_reminder(task)
            logger.info(f"Sent 3-day reminder for task {task.id}: {task.title}")
        except Exception as e:
            logger.error(f"Failed to send 3-day reminder for task {task.id}: {str(e)}")
    
    total_sent = tasks_due_tomorrow.count() + tasks_due_in_three_days.count()
    logger.info(f"Sent {total_sent} task due reminders")
    
    return {
        'sent': total_sent,
        'due_tomorrow': tasks_due_tomorrow.count(),
        'due_in_three_days': tasks_due_in_three_days.count()
    }


@shared_task
def assign_tasks_to_students_weekly():
    """
    Tarea periódica semanal (domingos).
    Para cada proyecto activo, asigna automáticamente todos los miembros
    con rol STUDENT al campo assigned_students de cada tarea abierta
    del proyecto. No crea tareas duplicadas; solo garantiza que cada
    estudiante miembro del proyecto aparezca en assigned_students.
    """
    from apps.projects.models import Project, ProjectMember
    from apps.authentication.models import CustomUser

    now = timezone.now()
    logger.info(f"[WeeklyAssign] Iniciando asignación semanal de tareas a estudiantes - {now}")

    # Proyectos activos (no archivados, no cancelados)
    active_projects = Project.objects.filter(
        es_archivado=False
    ).exclude(
        status='CANCELLED'
    )

    total_projects = 0
    total_tasks_updated = 0
    total_assignments = 0

    for project in active_projects:
        # Obtener IDs de miembros del proyecto que sean STUDENT
        student_member_ids = ProjectMember.objects.filter(
            project=project,
            user__role=CustomUser.Role.STUDENT,
            user__is_active=True
        ).values_list('user_id', flat=True)

        if not student_member_ids:
            continue

        # Tareas abiertas / activas del proyecto (excluir cerradas y completadas)
        open_tasks = Task.objects.filter(
            project=project,
            status__in=['DRAFT', 'OPEN', 'IN_REVIEW', 'REOPENED', 'PENDING', 'IN_PROGRESS', 'FOR_REVIEW']
        ).prefetch_related('assigned_students')

        if not open_tasks.exists():
            continue

        project_assignments = 0
        project_tasks_touched = 0

        for task in open_tasks:
            already_assigned_ids = set(task.assigned_students.values_list('id', flat=True))
            new_student_ids = set(student_member_ids) - already_assigned_ids

            if new_student_ids:
                task.assigned_students.add(*new_student_ids)
                project_assignments += len(new_student_ids)
                project_tasks_touched += 1

        if project_tasks_touched > 0:
            total_projects += 1
            total_tasks_updated += project_tasks_touched
            total_assignments += project_assignments
            logger.info(
                f"[WeeklyAssign] Proyecto '{project.name}' (ID:{project.id}): "
                f"{project_tasks_touched} tareas actualizadas, "
                f"{project_assignments} asignaciones nuevas"
            )

    summary = {
        'timestamp': now.isoformat(),
        'projects_processed': total_projects,
        'tasks_updated': total_tasks_updated,
        'new_assignments': total_assignments,
    }
    logger.info(f"[WeeklyAssign] Resumen final: {summary}")
    return summary
