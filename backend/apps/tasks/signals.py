from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from apps.core.audit import actor_label, current_actor, log_activity
from .models import Task, TaskSubmission
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

# Estados que se consideran "completados"
_ESTADOS_COMPLETADOS = {'COMPLETED', 'CLOSED'}


@receiver(pre_save, sender=Task)
def capture_task_previous_status(sender, instance, **kwargs):
    """
    Guarda el estado anterior de la tarea en el instance antes de guardar,
    para que audit_task_save pueda detectar cambios de estado.
    """
    if instance.pk:
        try:
            instance._previous_status = Task.objects.only('status').get(pk=instance.pk).status
        except Task.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender=Task)
def audit_task_save(sender, instance, created, **kwargs):
    """Registra creación, completado y edición de tareas en el log de auditoría."""
    actor = current_actor()
    previous_status = getattr(instance, '_previous_status', None)

    if created:
        accion, verbo = 'TAREA_CREADA', 'creó la tarea'
    elif (
        instance.status in _ESTADOS_COMPLETADOS
        and previous_status not in _ESTADOS_COMPLETADOS
    ):
        accion, verbo = 'TAREA_COMPLETADA', 'marcó como completada la tarea'
    else:
        accion, verbo = 'TAREA_ACTUALIZADA', 'editó la tarea'

    log_activity(
        accion=accion,
        descripcion=(
            f"{actor_label(actor)} {verbo} '{instance.title}' "
            f"en el proyecto '{instance.project.name}'."
        ),
        actor=actor,
        tarea_id=instance.pk,
        proyecto_id=instance.project_id,
        metadata={
            'tarea_titulo': instance.title,
            'proyecto_id': instance.project_id,
            'status': instance.status,
            'status_anterior': previous_status,
        },
    )


@receiver(pre_delete, sender=Task)
def audit_task_delete(sender, instance, **kwargs):
    """Registra la eliminación de una tarea en el log de auditoría."""
    actor = current_actor()
    log_activity(
        accion='TAREA_ELIMINADA',
        descripcion=(
            f"{actor_label(actor)} eliminó la tarea '{instance.title}' "
            f"del proyecto '{instance.project.name}'."
        ),
        actor=actor,
        tarea_id=instance.pk,
        proyecto_id=instance.project_id,
        metadata={'tarea_titulo': instance.title, 'proyecto_id': instance.project_id},
    )


@receiver(post_save, sender=TaskSubmission)
def audit_submission_created(sender, instance, created, **kwargs):
    """Registra cada entrega que sube un alumno / empleado."""
    if not created:
        return
    actor = current_actor() or instance.submitted_by
    task = instance.task
    log_activity(
        accion='ENTREGA_REALIZADA',
        descripcion=(
            f"{actor_label(actor)} entregó la tarea '{task.title}' "
            f"del proyecto '{task.project.name}'"
            + (f" (versión {instance.version})." if getattr(instance, 'version', None) else ".")
        ),
        actor=actor,
        tarea_id=task.pk,
        proyecto_id=task.project_id,
        metadata={'tarea_titulo': task.title, 'entrega_id': instance.pk,
                  'version': getattr(instance, 'version', None)},
    )


@receiver(post_save, sender=Task)
def create_task_assignment_notification(sender, instance, created, **kwargs):
    """
    Señal de auditoría: solo registra la actividad.
    Las notificaciones WebSocket se envían desde perform_create via
    transaction.on_commit() para evitar race conditions con el campo
    M2M assigned_students (que se guarda DESPUÉS del post_save).
    """
    # Las notificaciones al usuario se manejan en perform_create (views.py)
    # para garantizar que assigned_students ya esté guardado cuando el
    # estudiante recibe la notificación y hace su primera petición.
    pass


@receiver(post_save, sender=TaskSubmission)
def create_task_submission_notification(sender, instance, created, **kwargs):
    """
    Notifica a los revisores cuando llega una entrega.

    Las notificaciones de aprobación o devolución ya no salen de aquí: las envía
    apps.tasks.review.notify_decision con un mensaje distinto para cada caso
    (antes el alumno recibía "calificada" y "devuelta" para la misma entrega).
    """
    if not created:
        return

    from .review import submission_received_message

    task = instance.task
    recipients = set()
    if task.created_by and task.created_by != instance.submitted_by:
        recipients.add(task.created_by)
    if hasattr(task.project, 'members'):
        recipients.update(
            m for m in task.project.members.all()
            if m.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR', 'DIRECTOR']
            and m != instance.submitted_by
        )

    title, message = submission_received_message(instance)
    channel_layer = get_channel_layer()
    for recipient in recipients:
        try:
            notification = Notification.objects.create(
                user=recipient,
                title=title,
                message=message,
                notification_type=Notification.NotificationType.TASK_COMPLETED,
                content_object=task,
            )
            async_to_sync(channel_layer.group_send)(
                f'user_{recipient.id}_notifications',
                {'type': 'send_notification', 'message': NotificationSerializer(notification).data},
            )
        except Exception as exc:
            logger.error("Error notificando entrega %s a %s: %s", instance.pk, recipient.pk, exc)

    try:
        from utils.email_notifications import send_email_notification
        from django.conf import settings

        recipient_emails = [r.email for r in recipients if r.email]
        if recipient_emails:
            send_email_notification(
                subject=f"{title}: {task.title}",
                recipient_list=recipient_emails,
                template_name='emails/task_submitted.txt',
                context={
                    'task': task,
                    'submission': instance,
                    'student': instance.submitted_by,
                    'project': task.project,
                    'frontend_url': settings.FRONTEND_URL,
                },
                html_template_name='emails/task_submitted.html',
            )
    except Exception as e:
        logger.error(f"Error sending email notification for task submission {task.id}: {str(e)}")
