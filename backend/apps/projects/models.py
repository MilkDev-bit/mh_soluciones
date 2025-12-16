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


class Channel(TimeStampedModel):
    """
    Representa un canal de comunicación dentro de un proyecto/equipo.
    Similar a los canales en Microsoft Teams.
    """
    class ChannelType(models.TextChoices):
        GENERAL = 'GENERAL', _('General')
        ANNOUNCEMENTS = 'ANNOUNCEMENTS', _('Anuncios')
        CUSTOM = 'CUSTOM', _('Personalizado')
    
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='channels',
        verbose_name=_("Proyecto")
    )
    name = models.CharField(
        max_length=100,
        verbose_name=_("Nombre del Canal")
    )
    description = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    channel_type = models.CharField(
        max_length=20,
        choices=ChannelType.choices,
        default=ChannelType.CUSTOM,
        verbose_name=_("Tipo de Canal")
    )
    is_private = models.BooleanField(
        default=False,
        verbose_name=_("Canal Privado")
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_channels',
        verbose_name=_("Creado por")
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='channels',
        verbose_name=_("Miembros"),
        help_text=_("Solo para canales privados")
    )
    
    class Meta:
        verbose_name = _("Canal")
        verbose_name_plural = _("Canales")
        ordering = ['created_at']
        unique_together = [['project', 'name']]
    
    def __str__(self):
        return f"{self.name} - {self.project.name}"


class ChannelMessage(TimeStampedModel):
    """
    Representa un mensaje o publicación en un canal.
    """
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='messages',
        verbose_name=_("Canal")
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='channel_messages',
        verbose_name=_("Autor")
    )
    content = models.TextField(
        verbose_name=_("Contenido")
    )
    parent_message = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies',
        verbose_name=_("Mensaje Padre")
    )
    attachments = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("Archivos Adjuntos"),
        help_text=_("Lista de objetos con: name, url, size, mime_type")
    )
    mentions = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='mentioned_in_messages',
        verbose_name=_("Menciones")
    )
    is_edited = models.BooleanField(
        default=False,
        verbose_name=_("Editado")
    )
    edited_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Edición")
    )
    reactions = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("Reacciones"),
        help_text=_("Objeto con emoji: [user_ids]")
    )
    
    class Meta:
        verbose_name = _("Mensaje de Canal")
        verbose_name_plural = _("Mensajes de Canal")
        ordering = ['created_at']
    
    def __str__(self):
        return f"Mensaje de {self.author.username} en {self.channel.name}"


class ChannelFile(TimeStampedModel):
    """
    Representa un archivo compartido en un canal.
    """
    channel = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='files',
        verbose_name=_("Canal")
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='uploaded_channel_files',
        verbose_name=_("Subido por")
    )
    file = models.FileField(
        upload_to='channel_files/',
        verbose_name=_("Archivo")
    )
    file_name = models.CharField(
        max_length=255,
        verbose_name=_("Nombre del Archivo")
    )
    file_size = models.BigIntegerField(
        verbose_name=_("Tamaño del Archivo (bytes)")
    )
    mime_type = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_("Tipo MIME")
    )
    description = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    
    class Meta:
        verbose_name = _("Archivo de Canal")
        verbose_name_plural = _("Archivos de Canal")
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.file_name} en {self.channel.name}"