import logging
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from apps.notifications.api.serializers import NotificationSerializer
from apps.core.middleware import get_current_audit_user
from .models import Project, ProjectMember

logger = logging.getLogger(__name__)


def _log_actividad(accion, descripcion, usuario, proyecto_id=None, metadata=None):
    """Helper para registrar actividad de forma segura sin interrumpir el flujo principal."""
    try:
        from apps.core.models import RegistroActividad
        RegistroActividad.objects.create(
            usuario=usuario,
            accion=accion,
            descripcion=descripcion,
            proyecto_id=proyecto_id,
            metadata=metadata or {},
        )
    except Exception as exc:
        logger.error("Error al registrar actividad de auditoría [%s]: %s", accion, exc)


@receiver(post_save, sender=Project)
def audit_project_save(sender, instance, created, **kwargs):
    """Registra creación y edición de proyectos en el log de auditoría."""
    actor = get_current_audit_user() or instance.created_by
    if actor is None:
        return

    if created:
        accion = 'PROYECTO_CREADO'
        descripcion = f"{actor.username} creó el proyecto '{instance.name}'."
    else:
        accion = 'PROYECTO_ACTUALIZADO'
        descripcion = f"{actor.username} editó el proyecto '{instance.name}'."

    _log_actividad(
        accion=accion,
        descripcion=descripcion,
        usuario=actor,
        proyecto_id=instance.pk,
        metadata={'proyecto_nombre': instance.name},
    )


@receiver(pre_delete, sender=Project)
def audit_project_delete(sender, instance, **kwargs):
    """Registra la eliminación de un proyecto en el log de auditoría."""
    actor = get_current_audit_user() or instance.created_by
    if actor is None:
        return

    _log_actividad(
        accion='PROYECTO_ELIMINADO',
        descripcion=f"{actor.username} eliminó el proyecto '{instance.name}'.",
        usuario=actor,
        proyecto_id=instance.pk,
        metadata={'proyecto_nombre': instance.name},
    )


@receiver(pre_delete, sender=ProjectMember)
def audit_member_remove(sender, instance, **kwargs):
    """Registra la remoción de un miembro de proyecto en el log de auditoría."""
    actor = get_current_audit_user()
    if actor is None:
        return

    _log_actividad(
        accion='MIEMBRO_REMOVIDO',
        descripcion=(
            f"{actor.username} removió a '{instance.user.username}' "
            f"del proyecto '{instance.project.name}'."
        ),
        usuario=actor,
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

