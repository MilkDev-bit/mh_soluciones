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
    con rol STUDENT al campo assigned_students de las 7 tareas estándar
    del proyecto. Si existen duplicados con el mismo nombre, solo se
    toma la más reciente de cada tipo.

    Tareas objetivo (case-insensitive):
      - Matriz de cumplimiento SH
      - Platicas de seguridad
      - PIRAMIDE SH
      - QR WEEKLY
      - GRAFICAS
      - Campañas
      - KPI
    """
    from apps.projects.models import Project, ProjectMember
    from apps.authentication.models import CustomUser

    # Los 7 nombres canónicos (en minúsculas para comparación)
    TASK_NAMES = [
        'matriz de cumplimiento sh',
        'platicas de seguridad',
        'piramide sh',
        'qr weekly',
        'graficas',
        'campañas',
        'kpi',
    ]

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

        # Buscar solo las tareas que coincidan con los 7 nombres canónicos
        # Si hay duplicados con el mismo nombre, tomar solo la más reciente
        target_tasks = []
        for task_name in TASK_NAMES:
            matching = Task.objects.filter(
                project=project,
                title__iexact=task_name
            ).order_by('-created_at')

            if matching.exists():
                target_tasks.append(matching.first())

        if not target_tasks:
            continue

        project_assignments = 0
        project_tasks_touched = 0

        for task in target_tasks:
            already_assigned_ids = set(task.assigned_students.values_list('id', flat=True))
            new_student_ids = set(student_member_ids) - already_assigned_ids

            if new_student_ids:
                task.assigned_students.add(*new_student_ids)
                project_assignments += len(new_student_ids)
                project_tasks_touched += 1
                logger.info(
                    f"[WeeklyAssign]   → Tarea '{task.title}' (ID:{task.id}): "
                    f"+{len(new_student_ids)} estudiantes asignados"
                )

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

