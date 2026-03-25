from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.projects.models import Project
from apps.core.utils import get_document_upload_path
from apps.core.validators import validate_file_extension


class Task(TimeStampedModel):
    """
    Representa una tarea específica dentro de un proyecto.
    """
    class TaskStatus(models.TextChoices):
        DRAFT = 'DRAFT', _('Borrador')
        OPEN = 'OPEN', _('Abierta')
        IN_REVIEW = 'IN_REVIEW', _('En Revisión')
        CLOSED = 'CLOSED', _('Cerrada')
        REOPENED = 'REOPENED', _('Reabierta')
        # Legacy statuses for backward compatibility
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
    assigned_students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='assigned_student_tasks',
        limit_choices_to={'role': 'STUDENT'},
        verbose_name=_("Estudiantes Asignados")
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
        default=TaskStatus.DRAFT,
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
    
    # New fields for Teams-like functionality
    open_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Apertura")
    )
    close_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Cierre")
    )
    max_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=100.00,
        verbose_name=_("Puntuación Máxima")
    )
    grading_criteria = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("Criterios de Calificación"),
        help_text=_("Lista de objetos con campos: name, description, points")
    )
    attachment = models.FileField(
        upload_to='task_attachments/',
        null=True,
        blank=True,
        validators=[validate_file_extension],
        verbose_name=_("Archivo Adjunto")
    )
    allow_late_submissions = models.BooleanField(
        default=False,
        verbose_name=_("Permitir Entregas Tardías")
    )
    accept_after_close = models.BooleanField(
        default=False,
        verbose_name=_("Aceptar Entregas Después del Cierre")
    )
    days_after_close = models.IntegerField(
        default=0,
        verbose_name=_("Días Adicionales Después del Cierre")
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
    class SubmissionStatus(models.TextChoices):
        SUBMITTED = 'SUBMITTED', _('Entregado')
        GRADED = 'GRADED', _('Calificado')
        PENDING = 'PENDING', _('Pendiente')
        LATE = 'LATE', _('Entrega Tardía')
    
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
        validators=[validate_file_extension],
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

    google_drive_file_id = models.CharField(
        max_length=255, 
        blank=True, 
        null=True,
        verbose_name=_("ID de Archivo en Google Drive")
    )
    google_drive_link = models.URLField(
        blank=True, 
        null=True,
        verbose_name=_("Enlace de Google Drive")
    )
    uploaded_to_drive = models.BooleanField(
        default=False,
        verbose_name=_("Subido a Google Drive")
    )
    
    # New fields for Teams-like functionality
    version = models.IntegerField(
        default=1,
        verbose_name=_("Versión de la Entrega")
    )
    status = models.CharField(
        max_length=20,
        choices=SubmissionStatus.choices,
        default=SubmissionStatus.SUBMITTED,
        verbose_name=_("Estado de la Entrega")
    )
    score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_("Puntuación")
    )
    teacher_feedback = models.TextField(
        blank=True,
        verbose_name=_("Retroalimentación del Docente")
    )
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='graded_submissions',
        verbose_name=_("Calificado por")
    )
    graded_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Calificación")
    )
    criteria_scores = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("Puntuaciones por Criterio"),
        help_text=_("Objeto con criterio_id: puntos")
    )
    files_metadata = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("Metadatos de Archivos"),
        help_text=_("Lista de objetos con name, gdrive_id, size, mime_type")
    )

    class Meta:
        verbose_name = _("Entrega de Tarea")
        verbose_name_plural = _("Entregas de Tareas")
        ordering = ['-created_at']
        unique_together = [['task', 'submitted_by', 'version']]

    def __str__(self):
        return f"Entrega de {self.submitted_by.username} para la tarea '{self.task.title}' (v{self.version})"

    def save(self, *args, **kwargs):
        """Sobrescribir save para actualizar uploaded_to_drive y asignar versión"""
        if self.google_drive_file_id and self.google_drive_link:
            self.uploaded_to_drive = True
        
        # Auto-asignar versión si es nueva entrega usando atomic transaction
        if not self.pk:
            from django.db import transaction
            with transaction.atomic():
                # Lock the rows to prevent race conditions
                previous_submissions = TaskSubmission.objects.filter(
                    task=self.task,
                    submitted_by=self.submitted_by
                ).select_for_update().order_by('-version')
                
                if previous_submissions.exists():
                    self.version = previous_submissions.first().version + 1
                else:
                    self.version = 1
        
        super().save(*args, **kwargs)


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


class TaskEditHistory(TimeStampedModel):
    """
    Almacena el historial de ediciones de una tarea.
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='edit_history',
        verbose_name=_("Tarea")
    )
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_("Editado por")
    )
    changes = models.JSONField(
        verbose_name=_("Cambios Realizados"),
        help_text=_("Objeto con campos modificados y sus valores anteriores")
    )
    edit_reason = models.TextField(
        blank=True,
        verbose_name=_("Razón del Cambio")
    )

    class Meta:
        verbose_name = _("Historial de Edición de Tarea")
        verbose_name_plural = _("Historial de Ediciones de Tareas")
        ordering = ['-created_at']

    def __str__(self):
        return f"Edición de {self.task.title} por {self.edited_by.username if self.edited_by else 'Usuario eliminado'}"


class TaskReopenLog(TimeStampedModel):
    """
    Registra cuando una tarea es reabierta.
    """
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name='reopen_logs',
        verbose_name=_("Tarea")
    )
    reopened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_("Reabierta por")
    )
    new_deadline = models.DateTimeField(
        verbose_name=_("Nuevo Deadline")
    )
    reason = models.TextField(
        blank=True,
        verbose_name=_("Razón de Reapertura")
    )
    specific_students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='reopened_tasks',
        verbose_name=_("Estudiantes Específicos"),
        help_text=_("Dejar en blanco para reabrir para todos")
    )

    class Meta:
        verbose_name = _("Registro de Reapertura de Tarea")
        verbose_name_plural = _("Registros de Reaperturas de Tareas")
        ordering = ['-created_at']

    def __str__(self):
        return f"Reapertura de {self.task.title} por {self.reopened_by.username if self.reopened_by else 'Usuario eliminado'}"
