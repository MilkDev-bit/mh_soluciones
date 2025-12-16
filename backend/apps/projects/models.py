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
    
    # Campos adicionales para funcionalidad tipo Teams
    icono = models.CharField(
        max_length=50,
        blank=True,
        default='FiBriefcase',
        verbose_name=_("Icono"),
        help_text=_("Nombre del icono de react-icons")
    )
    color = models.CharField(
        max_length=7,
        default='#2C74B3',
        verbose_name=_("Color (Hex)"),
        help_text=_("Color para visualización en la UI")
    )
    categoria = models.ForeignKey(
        'CategoriaProyecto',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='proyectos',
        verbose_name=_("Categoría")
    )
    es_archivado = models.BooleanField(
        default=False,
        verbose_name=_("¿Está Archivado?")
    )
    drive_folder_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name=_("ID de Carpeta en Google Drive")
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


class CategoriaProyecto(TimeStampedModel):
    """
    Categorías para agrupar proyectos
    """
    nombre = models.CharField(
        max_length=100,
        unique=True,
        verbose_name=_("Nombre de la Categoría")
    )
    descripcion = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    color = models.CharField(
        max_length=7,
        default='#2C74B3',
        verbose_name=_("Color (Hex)"),
        help_text=_("Color para visualización en la UI")
    )
    icono = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_("Icono"),
        help_text=_("Nombre del icono de react-icons")
    )

    class Meta:
        verbose_name = _("Categoría de Proyecto")
        verbose_name_plural = _("Categorías de Proyectos")
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Channel(TimeStampedModel):
    """
    Representa un canal dentro de un proyecto (similar a canales de Teams)
    """
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='canales',
        verbose_name=_("Proyecto")
    )
    nombre = models.CharField(
        max_length=255,
        verbose_name=_("Nombre del Canal")
    )
    descripcion = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    es_general = models.BooleanField(
        default=False,
        verbose_name=_("¿Es Canal General?"),
        help_text=_("El canal general no se puede eliminar")
    )
    creado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='canales_creados',
        verbose_name=_("Creado por")
    )
    miembros = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='canales_miembro',
        blank=True,
        verbose_name=_("Miembros del Canal")
    )
    es_privado = models.BooleanField(
        default=False,
        verbose_name=_("¿Es Privado?")
    )

    class Meta:
        verbose_name = _("Canal")
        verbose_name_plural = _("Canales")
        ordering = ['-es_general', 'nombre']
        unique_together = [['project', 'nombre']]

    def __str__(self):
        return f"{self.nombre} ({self.project.name})"


class MensajeCanal(TimeStampedModel):
    """
    Representa un mensaje en un canal de proyecto
    """
    canal = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='mensajes',
        verbose_name=_("Canal")
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mensajes_canal',
        verbose_name=_("Usuario")
    )
    contenido = models.TextField(
        verbose_name=_("Contenido del Mensaje")
    )
    mensaje_padre = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='respuestas',
        verbose_name=_("Mensaje Padre (para hilos)")
    )
    archivos_adjuntos = models.JSONField(
        default=list,
        blank=True,
        verbose_name=_("Archivos Adjuntos"),
        help_text=_("Lista de objetos con name, url, drive_id")
    )
    menciones = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='menciones_mensajes',
        blank=True,
        verbose_name=_("Usuarios Mencionados")
    )
    editado = models.BooleanField(
        default=False,
        verbose_name=_("¿Editado?")
    )
    editado_en = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Edición")
    )
    reacciones = models.JSONField(
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
        return f"Mensaje de {self.usuario.username} en {self.canal.nombre}"


class RecursoFijado(TimeStampedModel):
    """
    Recursos fijados en un canal para acceso rápido
    """
    canal = models.ForeignKey(
        Channel,
        on_delete=models.CASCADE,
        related_name='recursos_fijados',
        verbose_name=_("Canal")
    )
    titulo = models.CharField(
        max_length=255,
        verbose_name=_("Título del Recurso")
    )
    descripcion = models.TextField(
        blank=True,
        verbose_name=_("Descripción")
    )
    url = models.URLField(
        blank=True,
        null=True,
        verbose_name=_("URL del Recurso")
    )
    tipo_recurso = models.CharField(
        max_length=50,
        choices=[
            ('LINK', _('Enlace')),
            ('FILE', _('Archivo')),
            ('TASK', _('Tarea')),
            ('EVENT', _('Evento'))
        ],
        default='LINK',
        verbose_name=_("Tipo de Recurso")
    )
    fijado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_("Fijado por")
    )
    orden = models.IntegerField(
        default=0,
        verbose_name=_("Orden de Visualización")
    )

    class Meta:
        verbose_name = _("Recurso Fijado")
        verbose_name_plural = _("Recursos Fijados")
        ordering = ['orden', '-created_at']

    def __str__(self):
        return f"{self.titulo} - {self.canal.nombre}"