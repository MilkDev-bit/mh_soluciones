from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import Document

@receiver(post_save, sender=Document)
def create_document_upload_notification(sender, instance, created, **kwargs):
    if created and instance.project:
        # Notify all project members except the uploader
        recipients = set()
        if hasattr(instance.project, 'members'):
            members = instance.project.members.exclude(id=instance.uploaded_by.id if instance.uploaded_by else None)
            recipients.update(members)
        
        channel_layer = get_channel_layer()
        
        for recipient in recipients:
            notification = Notification.objects.create(
                user=recipient,
                title="Nuevo Archivo Subido",
                message=f"Se ha subido un nuevo archivo al proyecto '{instance.project.name}'.",
                notification_type=Notification.NotificationType.FILE_UPLOADED,
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
