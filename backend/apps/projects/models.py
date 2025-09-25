from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel

class Project(TimeStampedModel):
    """
    Representa un proyecto o "sala de trabajo".
    Contiene la información principal del proyecto y gestiona a sus miembros.
    """
    class ProjectStatus(models.TextChoices):
        PLANNING = 'PLANNING', _('Planificación')
        IN_PROGRESS = 'IN_PROGRESS', _('En Progreso')
        COMPLETED = 'COMPLETED', _('Completado')
        ON_HOLD = 'ON_HOLD', _('En Pausa')
        CANCELLED = 'CANCELLED', _('Cancelado')

    name = models.CharField(
        max_length=255,
        verbose_name=_("Nombre del Proyecto")
    )
    description = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    status = models.CharField(
        max_length=20,
        choices=ProjectStatus.choices,
        default=ProjectStatus.PLANNING,
        verbose_name=_("Estado")
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_projects',
        verbose_name=_("Creado por")
    )

    client = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='client_projects',
        limit_choices_to={'role': 'CLIENT'},
        verbose_name=_("Cliente")
    )
    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Inicio")
    )
    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Finalización")
    )
    
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        through='ProjectMember',
        related_name='projects',
        verbose_name=_("Miembros")
    )

    class Meta:
        verbose_name = _("Proyecto")
        verbose_name_plural = _("Proyectos")
        ordering = ['-created_at']

    def __str__(self):
        return self.name

@property
def progress(self):
        """
        Calcula el porcentaje de progreso del proyecto basándose en las tareas completadas.
        """
        total_tasks = self.tasks.count()
        if total_tasks == 0:
            return 0
        
        completed_tasks = self.tasks.filter(status='COMPLETED').count()
        progress_percentage = (completed_tasks / total_tasks) * 100
        return round(progress_percentage)

class ProjectMember(models.Model):
    """
    Modelo intermedio ('through' model) que conecta a los Usuarios con los Proyectos.
    Nos permite añadir información adicional a la relación, como un rol específico
    dentro del proyecto.
    """
    class ProjectRole(models.TextChoices):
        LEAD = 'LEAD', _('Líder de Proyecto')
        MEMBER = 'MEMBER', _('Miembro')
        VIEWER = 'VIEWER', _('Observador')

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        verbose_name=_("Proyecto")
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        verbose_name=_("Usuario")
    )
    role = models.CharField(
        max_length=20,
        choices=ProjectRole.choices,
        default=ProjectRole.MEMBER,
        verbose_name=_("Rol en el Proyecto")
    )
    joined_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_("Fecha de Unión")
    )

    class Meta:
        verbose_name = _("Miembro de Proyecto")
        verbose_name_plural = _("Miembros de Proyectos")
        unique_together = ('project', 'user')

    def __str__(self):
        return f"{self.user.get_full_name()} en el proyecto {self.project.name}"
    

class ProjectComment(TimeStampedModel):
    """
    Almacena un comentario hecho por un usuario en un proyecto específico.
    """
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE, 
        related_name='comments',
        verbose_name=_("Proyecto")
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        verbose_name=_("Usuario")
    )
    comment = models.TextField(verbose_name=_("Comentario"))

    class Meta:
        verbose_name = _("Comentario de Proyecto")
        verbose_name_plural = _("Comentarios de Proyectos")
        ordering = ['created_at']

    def __str__(self):
        return f"Comentario de {self.user.username} en {self.project.name}"


class ProjectSubmission(TimeStampedModel):
    """
    Representa una entrega o archivo general para un proyecto.
    """
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE, 
        related_name='submissions',
        verbose_name=_("Proyecto")
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE,
        verbose_name=_("Subido por")
    )
    notes = models.TextField(blank=True, verbose_name=_("Notas de la entrega"))
    link = models.URLField(blank=True, null=True, verbose_name=_("Enlace de entrega"))
    file = models.FileField(upload_to='project_submissions/', blank=True, null=True, verbose_name=_("Archivo adjunto"))

    class Meta:
        verbose_name = _("Entrega de Proyecto")
        verbose_name_plural = _("Entregas de Proyectos")
        ordering = ['-created_at']

    def __str__(self):
        return f"Entrega de {self.submitted_by.username} para {self.project.name}"