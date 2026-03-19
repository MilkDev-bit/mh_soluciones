from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import Task, TaskSubmission
from utils.email_notifications import send_task_assignment_notification
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


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
