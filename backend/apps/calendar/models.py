from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.projects.models import Project

class CalendarEvent(TimeStampedModel):
    """
    Representa un evento en el calendario de un proyecto específico.
    Puede ser una reunión, un hito, una fecha límite importante, etc.
    """
    class EventColor(models.TextChoices):
        BLUE = '#2C74B3', _('Azul (Información)')
        GREEN = '#198754', _('Verde (Hito)')
        YELLOW = '#ffc107', _('Amarillo (Advertencia)')
        RED = '#dc3545', _('Rojo (Urgente)')

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='calendar_events',
        verbose_name=_("Proyecto")
    )
    title = models.CharField(
        max_length=255,
        verbose_name=_("Título del Evento")
    )
    description = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    start_time = models.DateTimeField(
        verbose_name=_("Fecha y Hora de Inicio")
    )
    end_time = models.DateTimeField(
        verbose_name=_("Fecha y Hora de Finalización")
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_events',
        verbose_name=_("Creado por")
    )
    color = models.CharField(
        max_length=7,
        choices=EventColor.choices,
        default=EventColor.BLUE,
        verbose_name=_("Color del Evento")
    )

    class Meta:
        verbose_name = _("Evento de Calendario")
        verbose_name_plural = _("Eventos de Calendario")
        ordering = ['start_time']

    def __str__(self):
        return f"{self.title} ({self.project.name})"