from django.db.models.signals import post_save, pre_save, pre_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from apps.core.middleware import get_current_audit_user
from .models import Task, TaskSubmission
from utils.email_notifications import send_task_assignment_notification
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

# Estados que se consideran "completados"
_ESTADOS_COMPLETADOS = {'COMPLETED', 'CLOSED'}


def _log_actividad(accion, descripcion, usuario, tarea_id=None, proyecto_id=None, metadata=None):
    """Helper para registrar actividad de forma segura sin interrumpir el flujo principal."""
    try:
        from apps.core.models import RegistroActividad
        RegistroActividad.objects.create(
            usuario=usuario,
            accion=accion,
            descripcion=descripcion,
            tarea_id=tarea_id,
            proyecto_id=proyecto_id,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.error("Error al registrar actividad de auditoría [%s]: %s", accion, exc)


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
    actor = get_current_audit_user() or instance.created_by
    if actor is None:
        return

    previous_status = getattr(instance, '_previous_status', None)

    if created:
        accion = 'TAREA_CREADA'
        descripcion = (
            f"{actor.username} creó la tarea '{instance.title}' "
            f"en el proyecto '{instance.project.name}'."
        )
    elif (
        instance.status in _ESTADOS_COMPLETADOS
        and previous_status not in _ESTADOS_COMPLETADOS
    ):
        accion = 'TAREA_COMPLETADA'
        descripcion = (
            f"{actor.username} marcó como completada la tarea '{instance.title}' "
            f"en el proyecto '{instance.project.name}'."
        )
    else:
        accion = 'TAREA_ACTUALIZADA'
        descripcion = (
            f"{actor.username} editó la tarea '{instance.title}' "
            f"en el proyecto '{instance.project.name}'."
        )

    _log_actividad(
        accion=accion,
        descripcion=descripcion,
        usuario=actor,
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
    actor = get_current_audit_user() or instance.created_by
    if actor is None:
        return

    _log_actividad(
        accion='TAREA_ELIMINADA',
        descripcion=(
            f"{actor.username} eliminó la tarea '{instance.title}' "
            f"del proyecto '{instance.project.name}'."
        ),
        usuario=actor,
        tarea_id=instance.pk,
        proyecto_id=instance.project_id,
        metadata={'tarea_titulo': instance.title, 'proyecto_id': instance.project_id},
    )


@receiver(post_save, sender=Task)
def create_task_assignment_notification(sender, instance, created, **kwargs):
    """
    Señal que se activa después de guardar una Tarea.
    Crea y envía una notificación si se asigna (o reasigna) una tarea a un usuario.
    """
    if instance.assigned_to and instance.assigned_to != instance.created_by:
        if created:
            title = "Nueva Tarea Asignada"
            message = f"Se te ha asignado una nueva tarea: '{instance.title}' en el proyecto '{instance.project.name}'."
        else:
            # title = "Tarea Actualizada"
            # message = f"La tarea '{instance.title}' en la que participas ha sido actualizada."
            return

        notification = Notification.objects.create(
            user=instance.assigned_to,
            title=title,
            message=message,
            notification_type=Notification.NotificationType.TASK_ASSIGNED,
            content_object=instance
        )

        channel_layer = get_channel_layer()
        group_name = f'user_{instance.assigned_to.id}_notifications'
        
        serialized_notification = NotificationSerializer(notification).data

        print(f"Enviando notificación al grupo: {group_name}")

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'send_notification',
                'message': serialized_notification
            }
        )

        # Send email notification for task assignment
        if created:
            try:
                send_task_assignment_notification(instance)
                logger.info(f"Email notification sent for task assignment: {instance.title}")
            except Exception as e:
                logger.error(f"Error sending email notification for task {instance.id}: {str(e)}")


@receiver(post_save, sender=TaskSubmission)
def create_task_submission_notification(sender, instance, created, **kwargs):
    """
    Send notification when a task is submitted or graded.
    """
    if not created and instance.status == 'GRADED' and instance.graded_by:
        # Notify student that their submission was graded
        notification = Notification.objects.create(
            user=instance.submitted_by,
            title="Tarea Calificada",
            message=f"Tu entrega para la tarea '{instance.task.title}' ha sido calificada. Puntuación: {instance.score}/{instance.task.max_score}",
            notification_type=Notification.NotificationType.TASK_COMPLETED,
            content_object=instance.task
        )

        channel_layer = get_channel_layer()
        group_name = f'user_{instance.submitted_by.id}_notifications'
        serialized_notification = NotificationSerializer(notification).data

        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'send_notification',
                'message': serialized_notification
            }
        )

        # Send email notification
        try:
            from utils.email_notifications import send_email_notification
            from django.conf import settings
            
            if instance.submitted_by.email:
                context = {
                    'task': instance.task,
                    'submission': instance,
                    'score': instance.score,
                    'max_score': instance.task.max_score,
                    'feedback': instance.teacher_feedback,
                    'project': instance.task.project,
                    'frontend_url': settings.FRONTEND_URL,
                }
                
                send_email_notification(
                    subject=f"Tarea Calificada: {instance.task.title}",
                    recipient_list=[instance.submitted_by.email],
                    template_name='emails/task_graded.txt',
                    context=context,
                    html_template_name='emails/task_graded.html'
                )
                logger.info(f"Email notification sent for graded task: {instance.task.title}")
        except Exception as e:
            logger.error(f"Error sending email notification for graded task {instance.task.id}: {str(e)}")
            
    elif created:
        task = instance.task
        
        recipients = set()
        
        if task.created_by and task.created_by != instance.submitted_by:
            recipients.add(task.created_by)
        
        if hasattr(task.project, 'members'):
            admin_members = [m for m in task.project.members.all() 
                           if m.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'PROFESSOR'] 
                           and m != instance.submitted_by]
            recipients.update(admin_members)
        
        for recipient in recipients:
            notification = Notification.objects.create(
                user=recipient,
                title="Nueva Entrega de Tarea",
                message=f"{instance.submitted_by.get_full_name()} ha entregado la tarea '{task.title}'",
                notification_type=Notification.NotificationType.TASK_COMPLETED,
                content_object=task
            )

            channel_layer = get_channel_layer()
            group_name = f'user_{recipient.id}_notifications'
            serialized_notification = NotificationSerializer(notification).data

            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'send_notification',
                    'message': serialized_notification
                }
            )

        try:
            from utils.email_notifications import send_email_notification
            from django.conf import settings
            
            recipient_emails = [r.email for r in recipients if r.email]
            
            if recipient_emails:
                context = {
                    'task': task,
                    'submission': instance,
                    'student': instance.submitted_by,
                    'project': task.project,
                    'frontend_url': settings.FRONTEND_URL,
                }
                
                send_email_notification(
                    subject=f"Nueva Entrega: {task.title}",
                    recipient_list=recipient_emails,
                    template_name='emails/task_submitted.txt',
                    context=context,
                    html_template_name='emails/task_submitted.html'
                )
                logger.info(f"Email notification sent for task submission: {task.title}")
        except Exception as e:
            logger.error(f"Error sending email notification for task submission {task.id}: {str(e)}")
