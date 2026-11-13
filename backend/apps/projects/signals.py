import logging
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from apps.core.audit import actor_label, current_actor, log_activity
from .models import Project, ProjectMember

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Project)
def audit_project_save(sender, instance, created, **kwargs):
    """Registra creación y edición de proyectos en el log de auditoría."""
    actor = current_actor()
    if created:
        accion, verbo = 'PROYECTO_CREADO', 'creó'
    else:
        accion, verbo = 'PROYECTO_ACTUALIZADO', 'editó'
    log_activity(
        accion=accion,
        descripcion=f"{actor_label(actor)} {verbo} el proyecto '{instance.name}'.",
        actor=actor,
        proyecto_id=instance.pk,
        metadata={'proyecto_nombre': instance.name},
    )


@receiver(pre_delete, sender=Project)
def audit_project_delete(sender, instance, **kwargs):
    """Registra la eliminación de un proyecto en el log de auditoría."""
    actor = current_actor()
    log_activity(
        accion='PROYECTO_ELIMINADO',
        descripcion=f"{actor_label(actor)} eliminó el proyecto '{instance.name}'.",
        actor=actor,
        proyecto_id=instance.pk,
        metadata={'proyecto_nombre': instance.name},
    )


@receiver(post_save, sender=ProjectMember)
def audit_member_add(sender, instance, created, **kwargs):
    """Registra cuando se agrega un miembro a un proyecto."""
    if not created:
        return
    actor = current_actor()
    log_activity(
        accion='MIEMBRO_AGREGADO',
        descripcion=(
            f"{actor_label(actor)} agregó a '{actor_label(instance.user)}' "
            f"al proyecto '{instance.project.name}'."
        ),
        actor=actor,
        proyecto_id=instance.project_id,
        metadata={
            'miembro_username': instance.user.username,
            'miembro_id': instance.user_id,
            'proyecto_nombre': instance.project.name,
        },
    )


@receiver(pre_delete, sender=ProjectMember)
def audit_member_remove(sender, instance, **kwargs):
    """Registra la remoción de un miembro de proyecto en el log de auditoría."""
    actor = current_actor()
    log_activity(
        accion='MIEMBRO_REMOVIDO',
        descripcion=(
            f"{actor_label(actor)} removió a '{actor_label(instance.user)}' "
            f"del proyecto '{instance.project.name}'."
        ),
        actor=actor,
        proyecto_id=instance.project_id,
        metadata={
            'miembro_username': instance.user.username,
            'miembro_id': instance.user_id,
            'proyecto_nombre': instance.project.name,
        },
    )


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

