"""
Celery tasks for the tasks app
Handles periodic tasks like sending due date reminders
"""
from celery import shared_task
from django.utils import timezone
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
    ).exclude(
        assigned_to__isnull=True,
        assigned_students__isnull=True
    ).select_related('project', 'assigned_to').prefetch_related('assigned_students')
    
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
    ).exclude(
        assigned_to__isnull=True,
        assigned_students__isnull=True
    ).select_related('project', 'assigned_to').prefetch_related('assigned_students')
    
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
