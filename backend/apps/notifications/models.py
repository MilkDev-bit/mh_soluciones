from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from apps.core.models import TimeStampedModel

class Notification(TimeStampedModel):
    """
    Modelo para almacenar notificaciones para los usuarios.
    """
    class NotificationType(models.TextChoices):
        INFO = 'INFO', _('Información')
        TASK_ASSIGNED = 'TASK_ASSIGNED', _('Tarea Asignada')
        TASK_DUE = 'TASK_DUE', _('Tarea Próxima a Vencer')
        TASK_OVERDUE = 'TASK_OVERDUE', _('Tarea Vencida')
        TASK_COMPLETED = 'TASK_COMPLETED', _('Tarea Completada')
        PROJECT_UPDATE = 'PROJECT_UPDATE', _('Actualización de Proyecto')
        MENTION = 'MENTION', _('Mención')
        COMMENT_REPLY = 'COMMENT_REPLY', _('Respuesta a Comentario')
        FILE_UPLOADED = 'FILE_UPLOADED', _('Archivo Subido')
        CALENDAR_EVENT = 'CALENDAR_EVENT', _('Evento de Calendario')
        EVENT_REMINDER = 'EVENT_REMINDER', _('Recordatorio de Evento')
        TEAM_INVITATION = 'TEAM_INVITATION', _('Invitación a Equipo')
        ROLE_CHANGE = 'ROLE_CHANGE', _('Cambio de Rol')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        verbose_name=_("Usuario")
    )
    title = models.CharField(max_length=255, verbose_name=_("Título"))
    message = models.TextField(verbose_name=_("Mensaje"))
    is_read = models.BooleanField(default=False, verbose_name=_("Leída"))
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType.choices,
        default=NotificationType.INFO
    )

    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    object_id = models.PositiveIntegerField(null=True, blank=True)
    content_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Notificación")
        verbose_name_plural = _("Notificaciones")
        ordering = ['-created_at']

    def __str__(self):
        return self.title