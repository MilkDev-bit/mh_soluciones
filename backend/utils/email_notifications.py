"""
Email notification utilities for MH Soluciones
Handles sending email notifications for calendar events, tasks, and other system events
"""
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


def deliver_email(subject, message, recipient_list, html_message=None):
    """Envía el correo por SMTP. Devuelve True si salió."""
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            html_message=html_message,
            # Antes fail_silently=True: un fallo SMTP se registraba como
            # "Email sent successfully". Ahora se registra el error real.
            fail_silently=False,
        )
        logger.info(f"Email sent successfully to {', '.join(recipient_list)}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {', '.join(recipient_list)}: {str(e)}")
        return False


def dispatch_email(subject, message, recipient_list, html_message=None):
    """
    Envía el correo SIN bloquear la petición.

    [RENDIMIENTO] Antes el correo (p. ej. "Nueva entrega" a 6 personas) se
    mandaba dentro de la petición del usuario: la entrega no respondía hasta
    que Gmail aceptaba el mensaje. Ahora va a Celery si hay worker (con
    reintentos) y, si no, a un hilo del servidor.
    """
    from apps.core.background import celery_worker_available, is_worker_process, run_in_thread

    recipient_list = list(recipient_list)
    if is_worker_process():
        return deliver_email(subject, message, recipient_list, html_message)
    if celery_worker_available():
        try:
            from apps.core.tasks import send_rendered_email
            send_rendered_email.delay(subject, message, recipient_list, html_message)
            return True
        except Exception as e:
            logger.warning(f"No se pudo encolar el correo en Celery ({e}); se envía en un hilo.")
    run_in_thread(deliver_email, subject, message, recipient_list, html_message)
    return True


def send_email_notification(subject, recipient_list, template_name, context, html_template_name=None):
    """
    Send an email notification using Django's email backend

    Args:
        subject: Email subject
        recipient_list: List of recipient email addresses
        template_name: Plain text template name
        context: Context dictionary for template rendering
        html_template_name: Optional HTML template name

    Las plantillas se renderizan aquí (pueden consultar la BD); el envío se
    hace en segundo plano con dispatch_email.
    """
    try:
        message = render_to_string(template_name, context)
        html_message = None
        if html_template_name:
            html_message = render_to_string(html_template_name, context)
        return dispatch_email(subject, message, recipient_list, html_message)
    except Exception as e:
        logger.error(f"Failed to send email to {', '.join(recipient_list)}: {str(e)}")
        return False


def send_mention_notification(comment, mentioned_user):
    """
    Send email notification when a user is @mentioned in a project comment.

    Args:
        comment: ProjectComment instance
        mentioned_user: CustomUser instance of the user who was mentioned
    """
    if not mentioned_user.email:
        return False

    subject = f"Te mencionaron en {comment.project.name}"
    context = {
        'comment': comment,
        'project': comment.project,
        'mentioned_user': mentioned_user,
        'author': comment.user,
        'frontend_url': settings.FRONTEND_URL,
    }

    return send_email_notification(
        subject=subject,
        recipient_list=[mentioned_user.email],
        template_name='emails/project_mention.txt',
        context=context,
        html_template_name='emails/project_mention.html',
    )


def send_reply_notification(reply_comment, notified_user):
    """
    Send email notification when someone replies to a comment.

    Args:
        reply_comment: ProjectComment instance (the reply, has a parent)
        notified_user: CustomUser instance of the parent comment author
    """
    if not notified_user.email:
        return False

    subject = f"Respondieron a tu comentario en {reply_comment.project.name}"
    context = {
        'reply': reply_comment,
        'parent_comment': reply_comment.parent,
        'project': reply_comment.project,
        'notified_user': notified_user,
        'author': reply_comment.user,
        'frontend_url': settings.FRONTEND_URL,
    }

    return send_email_notification(
        subject=subject,
        recipient_list=[notified_user.email],
        template_name='emails/project_reply.txt',
        context=context,
        html_template_name='emails/project_reply.html',
    )


def send_calendar_event_notification(event, action='created'):
    """
    Send notification when a calendar event is created, updated, or deleted
    
    Args:
        event: CalendarEvent instance
        action: One of 'created', 'updated', 'deleted'
    """
    project = event.project
    
    # Get all project members' emails
    recipient_list = [member.email for member in project.members.all() if member.email]
    
    if not recipient_list:
        logger.warning(f"No recipients found for calendar event notification: {event.title}")
        return False
    
    action_labels = {
        'created': 'creado',
        'updated': 'actualizado',
        'deleted': 'eliminado'
    }
    
    subject = f"Evento de Calendario {action_labels.get(action, 'modificado')}: {event.title}"
    
    context = {
        'event': event,
        'project': project,
        'action': action_labels.get(action, 'modificado'),
        'frontend_url': settings.FRONTEND_URL,
    }
    
    return send_email_notification(
        subject=subject,
        recipient_list=recipient_list,
        template_name='emails/calendar_event_notification.txt',
        context=context,
        html_template_name='emails/calendar_event_notification.html'
    )


def send_task_assignment_notification(task):
    """
    Send notification when a task is assigned to a user
    
    Args:
        task: Task instance
    """
    recipients = []
    
    # Add main assignee
    if task.assigned_to and task.assigned_to.email:
        recipients.append(task.assigned_to.email)
    
    # Add assigned students
    for student in task.assigned_students.all():
        if student.email:
            recipients.append(student.email)
    
    if not recipients:
        logger.warning(f"No recipients found for task assignment notification: {task.title}")
        return False
    
    subject = f"Nueva Tarea Asignada: {task.title}"
    
    context = {
        'task': task,
        'project': task.project,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    return send_email_notification(
        subject=subject,
        recipient_list=recipients,
        template_name='emails/task_assignment.txt',
        context=context,
        html_template_name='emails/task_assignment.html'
    )


def send_task_due_reminder(task):
    """
    Send reminder when a task is approaching its due date
    
    Args:
        task: Task instance
    """
    recipients = []
    
    # Add main assignee
    if task.assigned_to and task.assigned_to.email:
        recipients.append(task.assigned_to.email)
    
    # Add assigned students
    for student in task.assigned_students.all():
        if student.email:
            recipients.append(student.email)
    
    if not recipients:
        logger.warning(f"No recipients found for task due reminder: {task.title}")
        return False
    
    subject = f"Recordatorio: Tarea próxima a vencer - {task.title}"
    
    context = {
        'task': task,
        'project': task.project,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    return send_email_notification(
        subject=subject,
        recipient_list=recipients,
        template_name='emails/task_due_reminder.txt',
        context=context,
        html_template_name='emails/task_due_reminder.html'
    )


def send_task_reopened_notification(task, reopen_log):
    """
    Send notification when a task is reopened
    
    Args:
        task: Task instance
        reopen_log: TaskReopenLog instance
    """
    recipients = []
    
    # If specific students are mentioned, notify only them
    specific_students = reopen_log.specific_students.all()
    if specific_students:
        for student in specific_students:
            if student.email:
                recipients.append(student.email)
    else:
        # Otherwise notify all assigned users
        if task.assigned_to and task.assigned_to.email:
            recipients.append(task.assigned_to.email)
        
        for student in task.assigned_students.all():
            if student.email:
                recipients.append(student.email)
    
    if not recipients:
        logger.warning(f"No recipients found for task reopened notification: {task.title}")
        return False
    
    subject = f"Tarea Reabierta: {task.title}"
    
    context = {
        'task': task,
        'project': task.project,
        'reopen_log': reopen_log,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    return send_email_notification(
        subject=subject,
        recipient_list=recipients,
        template_name='emails/task_reopened.txt',
        context=context,
        html_template_name='emails/task_reopened.html'
    )


def send_task_returned_notification(task, submission):
    """
    Send notification when a task submission is returned/rejected for revision
    
    Args:
        task: Task instance
        submission: TaskSubmission instance
    """
    if not submission.submitted_by or not submission.submitted_by.email:
        logger.warning(f"No recipient found for task returned notification: {task.title}")
        return False
    
    subject = f"Tarea Devuelta para Revisión: {task.title}"
    
    context = {
        'task': task,
        'submission': submission,
        'project': task.project,
        'frontend_url': settings.FRONTEND_URL,
    }
    
    return send_email_notification(
        subject=subject,
        recipient_list=[submission.submitted_by.email],
        template_name='emails/task_returned.txt',
        context=context,
        html_template_name='emails/task_returned.html'
    )
