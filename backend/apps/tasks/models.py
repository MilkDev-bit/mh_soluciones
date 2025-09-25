from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.projects.models import Project
from apps.core.utils import get_document_upload_path

class Task(TimeStampedModel):
    """
    Representa una tarea específica dentro de un proyecto.
    """
    class TaskStatus(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        IN_PROGRESS = 'IN_PROGRESS', _('En Progreso')
        FOR_REVIEW = 'FOR_REVIEW', _('En Revisión')
        COMPLETED = 'COMPLETED', _('Completada')

    class TaskPriority(models.TextChoices):
        LOW = 'LOW', _('Baja')
        MEDIUM = 'MEDIUM', _('Media')
        HIGH = 'HIGH', _('Alta')

    title = models.CharField(
        max_length=255,
        verbose_name=_("Título de la Tarea")
    )
    description = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='tasks',
        verbose_name=_("Proyecto")
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_tasks',
        verbose_name=_("Asignada a")
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tasks',
        verbose_name=_("Creada por")
    )
    status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.PENDING,
        verbose_name=_("Estado")
    )
    priority = models.CharField(
        max_length=20,
        choices=TaskPriority.choices,
        default=TaskPriority.MEDIUM,
        verbose_name=_("Prioridad")
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Vencimiento")
    )

    class Meta:
        verbose_name = _("Tarea")
        verbose_name_plural = _("Tareas")
        ordering = ['due_date', 'priority']

    def __str__(self):
        return self.title


class TaskSubmission(TimeStampedModel):
    """
    Representa la entrega de un documento o enlace para una tarea.
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='submissions',
        verbose_name=_("Tarea")
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='task_submissions',
        verbose_name=_("Entregado por")
    )
    notes = models.TextField(
        blank=True,
        verbose_name=_("Notas de la Entrega")
    )
    link = models.URLField(
        blank=True, 
        null=True, 
        verbose_name=_("Enlace de entrega")
    )
    file = models.FileField(
        upload_to=get_document_upload_path,
        verbose_name=_("Archivo Entregado"),
        null=True,
        blank=True
    )
    correction_notes = models.TextField(
        blank=True,
        verbose_name=_("Notas de Corrección")
    )
    is_approved = models.BooleanField(
        default=False,
        verbose_name=_("¿Aprobada?")
    )

    class Meta:
        verbose_name = _("Entrega de Tarea")
        verbose_name_plural = _("Entregas de Tareas")
        ordering = ['-created_at']

    def __str__(self):
        return f"Entrega de {self.submitted_by.username} para la tarea '{self.task.title}'"

class TaskComment(TimeStampedModel):
    """
    Almacena un comentario hecho por un usuario en una tarea específica.
    """
    task = models.ForeignKey(
        Task, 
        on_delete=models.CASCADE, 
        related_name='comments',
        verbose_name=_("Tarea")
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        verbose_name=_("Usuario")
    )
    comment = models.TextField(verbose_name=_("Comentario"))

    class Meta:
        verbose_name = _("Comentario de Tarea")
        verbose_name_plural = _("Comentarios de Tareas")
        ordering = ['created_at']

    def __str__(self):
        return f"Comentario de {self.user.username} en {self.task.title}"