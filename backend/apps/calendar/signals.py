import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from .models import CalendarEvent

logger = logging.getLogger(__name__)


@receiver(post_save, sender=CalendarEvent)
def create_calendar_event_notification(sender, instance, created, **kwargs):
    if not (created and instance.project):
        return

    members = instance.project.members.all()
    if instance.created_by_id:
        members = members.exclude(id=instance.created_by_id)

    notifications = [
        Notification.objects.create(
            user=recipient,
            title="Nuevo Evento de Calendario",
            message=f"Se ha agendado '{instance.title}' en el proyecto '{instance.project.name}'.",
            notification_type=Notification.NotificationType.CALENDAR_EVENT,
            content_object=instance.project,
        )
        for recipient in members
    ]

    def push():
        # [FIX] Si Redis/Channels falla, el error ya no rompe la creación del
        # evento: la notificación queda guardada y se ve al recargar.
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        for notification in notifications:
            try:
                async_to_sync(channel_layer.group_send)(
                    f'user_{notification.user_id}_notifications',
                    {'type': 'send_notification', 'message': NotificationSerializer(notification).data},
                )
            except Exception as e:
                logger.warning(f"No se pudo enviar la notificación en tiempo real: {e}")

    transaction.on_commit(push)
