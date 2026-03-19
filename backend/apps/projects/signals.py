from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import ProjectMember

@receiver(post_save, sender=ProjectMember)
def create_project_member_notification(sender, instance, created, **kwargs):
    if created:
        notification = Notification.objects.create(
            user=instance.user,
            title="Añadido al Equipo",
            message=f"Has sido añadido al proyecto '{instance.project.name}' con el rol de {instance.get_role_display()}.",
            notification_type=Notification.NotificationType.TEAM_INVITATION,
            content_object=instance.project
        )
        
        channel_layer = get_channel_layer()
        group_name = f'user_{instance.user.id}_notifications'
        serialized_notification = NotificationSerializer(notification).data
        
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                'type': 'send_notification',
                'message': serialized_notification
            }
        )
