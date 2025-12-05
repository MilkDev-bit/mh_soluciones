from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import Task

User = get_user_model()

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
            content_object=instance.project
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