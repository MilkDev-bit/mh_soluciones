from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import CalendarEvent

@receiver(post_save, sender=CalendarEvent)
def create_calendar_event_notification(sender, instance, created, **kwargs):
    if created and instance.project:
        recipients = set()
        
        if hasattr(instance.project, 'members'):
            members = instance.project.members.exclude(id=instance.created_by.id if instance.created_by else None)
            recipients.update(members)

        channel_layer = get_channel_layer()
        
        for recipient in recipients:
            notification = Notification.objects.create(
                user=recipient,
                title="Nuevo Evento de Calendario",
                message=f"Se ha agendado '{instance.title}' en el proyecto '{instance.project.name}'.",
                notification_type=Notification.NotificationType.CALENDAR_EVENT,
                content_object=instance.project
            )
            
            group_name = f'user_{recipient.id}_notifications'
            serialized_notification = NotificationSerializer(notification).data
            
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    'type': 'send_notification',
                    'message': serialized_notification
                }
            )
