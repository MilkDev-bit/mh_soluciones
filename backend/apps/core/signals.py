import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _


class TimeStampedModel(models.Model):
    """
    Un modelo base abstracto que proporciona campos de fecha y hora de
    creación y actualización autogestionados.
    """
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Fecha de Creación")
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name=_("Fecha de Actualización")
    )

    class Meta:
        abstract = True
        ordering = ['-created_at']


class UUIDModel(models.Model):
    """
    Un modelo base abstracto que utiliza un UUID como clave primaria.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID"
    )

    class Meta:
        abstract = True

class SystemLog(models.Model):
    """
    Modelo para registrar eventos importantes que ocurren en el sistema.
    Útil para auditoría y depuración.
    """
    class LogLevel(models.TextChoices):
        INFO = 'INFO', _('Información')
        WARNING = 'WARNING', _('Advertencia')
        ERROR = 'ERROR', _('Error')

    timestamp = models.DateTimeField(auto_now_add=True)
    level = models.CharField(max_length=10, choices=LogLevel.choices, default=LogLevel.INFO)
    message = models.TextField()
    user = models.CharField(max_length=150, null=True, blank=True, help_text="Username del usuario que realizó la acción")

    def __str__(self):
        return f"[{self.timestamp}] [{self.level}] - {self.message}"

    class Meta:
        verbose_name = _("Registro del Sistema")
        verbose_name_plural = _("Registros del Sistema")
        ordering = ['-timestamp']