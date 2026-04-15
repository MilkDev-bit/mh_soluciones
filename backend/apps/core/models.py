import uuid
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


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
    Un modelo base abstracto que utiliza un UUID como clave primaria en lugar
    del ID numérico por defecto de Django.
    
    Esto es útil para los recursos expuestos en la API, ya que los UUIDs no son
    predecibles y no exponen el número total de registros.
    """
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        verbose_name="ID"
    )

    class Meta:
        abstract = True


class RegistroActividadQuerySet(models.QuerySet):
    """QuerySet que impide la eliminación de registros de auditoría."""

    def delete(self):
        raise PermissionError(
            "Los registros de auditoría no pueden eliminarse."
        )


class RegistroActividadManager(models.Manager):
    def get_queryset(self):
        return RegistroActividadQuerySet(self.model, using=self._db)


class RegistroActividad(TimeStampedModel):
    """
    Registro inmutable de todas las actividades del sistema (auditoría).
    """
    class TipoAccion(models.TextChoices):
        TAREA_CREADA = 'TAREA_CREADA', _('Tarea Creada')
        TAREA_ASIGNADA = 'TAREA_ASIGNADA', _('Tarea Asignada')
        TAREA_COMPLETADA = 'TAREA_COMPLETADA', _('Tarea Completada')
        TAREA_ACTUALIZADA = 'TAREA_ACTUALIZADA', _('Tarea Actualizada')
        TAREA_ELIMINADA = 'TAREA_ELIMINADA', _('Tarea Eliminada')
        PROYECTO_CREADO = 'PROYECTO_CREADO', _('Proyecto Creado')
        PROYECTO_ACTUALIZADO = 'PROYECTO_ACTUALIZADO', _('Proyecto Actualizado')
        PROYECTO_ELIMINADO = 'PROYECTO_ELIMINADO', _('Proyecto Eliminado')
        ARCHIVO_SUBIDO = 'ARCHIVO_SUBIDO', _('Archivo Subido')
        EVENTO_CREADO = 'EVENTO_CREADO', _('Evento de Calendario Creado')
        COMENTARIO_AGREGADO = 'COMENTARIO_AGREGADO', _('Comentario Agregado')
        MIEMBRO_AGREGADO = 'MIEMBRO_AGREGADO', _('Miembro Agregado al Proyecto')
        MIEMBRO_REMOVIDO = 'MIEMBRO_REMOVIDO', _('Miembro Removido del Proyecto')
        MENCION = 'MENCION', _('Mención en Mensaje')
        ENTREGA_REALIZADA = 'ENTREGA_REALIZADA', _('Entrega de Tarea Realizada')
        CANAL_CREADO = 'CANAL_CREADO', _('Canal Creado')

    objects = RegistroActividadManager()

    usuario = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.SET_NULL,
        null=True,
        related_name='actividades',
        verbose_name=_("Usuario")
    )
    actor_username = models.CharField(
        max_length=150,
        blank=True,
        verbose_name=_("Username del Actor"),
        help_text=_("Guardado para preservar el registro aunque se elimine el usuario")
    )
    accion = models.CharField(
        max_length=50,
        choices=TipoAccion.choices,
        verbose_name=_("Tipo de Acción")
    )
    descripcion = models.TextField(
        verbose_name=_("Descripción de la Actividad")
    )
    
    # Generic relation para vincular a cualquier modelo
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True
    )
    entidad_relacionada = GenericForeignKey('content_type', 'object_id')
    
    # Datos adicionales en formato JSON
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name=_("Metadatos Adicionales"),
        help_text=_("Información adicional sobre la actividad")
    )
    
    # Para filtrado eficiente
    proyecto_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name=_("ID del Proyecto Relacionado")
    )
    tarea_id = models.IntegerField(
        null=True,
        blank=True,
        db_index=True,
        verbose_name=_("ID de la Tarea Relacionada")
    )

    class Meta:
        verbose_name = _("Registro de Actividad")
        verbose_name_plural = _("Registros de Actividad")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at', 'usuario']),
            models.Index(fields=['proyecto_id', '-created_at']),
            models.Index(fields=['accion', '-created_at']),
        ]

    def save(self, *args, **kwargs):
        # Guardar actor_username automáticamente al crear
        if not self.pk and self.usuario and not self.actor_username:
            self.actor_username = self.usuario.username
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError(
            "Los registros de auditoría no pueden eliminarse."
        )

    def __str__(self):
        actor = self.actor_username or (self.usuario.username if self.usuario else 'Usuario eliminado')
        return f"{actor} - {self.get_accion_display()} - {self.created_at}"


class RegistroEmail(TimeStampedModel):
    """
    Registro de emails enviados por el sistema para auditoría
    """
    class TipoEmail(models.TextChoices):
        ASIGNACION_TAREA = 'ASIGNACION_TAREA', _('Asignación de Tarea')
        RECORDATORIO_VENCIMIENTO = 'RECORDATORIO_VENCIMIENTO', _('Recordatorio de Vencimiento')
        TAREA_VENCIDA = 'TAREA_VENCIDA', _('Tarea Vencida')
        EVENTO_CALENDARIO = 'EVENTO_CALENDARIO', _('Evento de Calendario')
        RECORDATORIO_EVENTO = 'RECORDATORIO_EVENTO', _('Recordatorio de Evento')
        TAREA_REABIERTA = 'TAREA_REABIERTA', _('Tarea Reabierta')
        TAREA_DEVUELTA = 'TAREA_DEVUELTA', _('Tarea Devuelta')
        RESUMEN_ACTIVIDAD = 'RESUMEN_ACTIVIDAD', _('Resumen de Actividad')
        INVITACION_PROYECTO = 'INVITACION_PROYECTO', _('Invitación a Proyecto')
        CAMBIO_ROL = 'CAMBIO_ROL', _('Cambio de Rol')
        MENCION = 'MENCION', _('Mención en Comentario')

    destinatario = models.ForeignKey(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        related_name='emails_recibidos',
        verbose_name=_("Destinatario")
    )
    email_destinatario = models.EmailField(
        verbose_name=_("Email del Destinatario")
    )
    tipo_email = models.CharField(
        max_length=50,
        choices=TipoEmail.choices,
        verbose_name=_("Tipo de Email")
    )
    asunto = models.CharField(
        max_length=500,
        verbose_name=_("Asunto del Email")
    )
    enviado_exitosamente = models.BooleanField(
        default=False,
        verbose_name=_("¿Enviado Exitosamente?")
    )
    error_mensaje = models.TextField(
        blank=True,
        verbose_name=_("Mensaje de Error")
    )
    entregado_en = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Entrega")
    )
    abierto = models.BooleanField(
        default=False,
        verbose_name=_("¿Abierto?")
    )
    abierto_en = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Fecha de Apertura")
    )
    
    # Para vincular con el objeto relacionado
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    object_id = models.PositiveIntegerField(
        null=True,
        blank=True
    )
    objeto_relacionado = GenericForeignKey('content_type', 'object_id')

    class Meta:
        verbose_name = _("Registro de Email")
        verbose_name_plural = _("Registros de Emails")
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['destinatario', '-created_at']),
            models.Index(fields=['tipo_email', '-created_at']),
            models.Index(fields=['enviado_exitosamente']),
        ]

    def __str__(self):
        return f"{self.tipo_email} - {self.email_destinatario} - {self.created_at}"


class PreferenciasNotificacion(models.Model):
    """
    Preferencias de notificación por usuario
    """
    usuario = models.OneToOneField(
        'authentication.CustomUser',
        on_delete=models.CASCADE,
        related_name='preferencias_notificacion',
        verbose_name=_("Usuario")
    )
    
    # Notificaciones por email
    email_tarea_asignada = models.BooleanField(
        default=True,
        verbose_name=_("Email: Tarea Asignada")
    )
    email_recordatorio_vencimiento = models.BooleanField(
        default=True,
        verbose_name=_("Email: Recordatorio de Vencimiento")
    )
    email_tarea_vencida = models.BooleanField(
        default=True,
        verbose_name=_("Email: Tarea Vencida")
    )
    email_evento_calendario = models.BooleanField(
        default=True,
        verbose_name=_("Email: Evento de Calendario")
    )
    email_recordatorio_evento = models.BooleanField(
        default=True,
        verbose_name=_("Email: Recordatorio de Evento")
    )
    email_mencion = models.BooleanField(
        default=True,
        verbose_name=_("Email: Menciones")
    )
    email_respuesta_comentario = models.BooleanField(
        default=True,
        verbose_name=_("Email: Respuestas a Comentarios")
    )
    email_resumen_diario = models.BooleanField(
        default=False,
        verbose_name=_("Email: Resumen Diario")
    )
    email_resumen_semanal = models.BooleanField(
        default=True,
        verbose_name=_("Email: Resumen Semanal")
    )
    
    # Notificaciones in-app
    app_tarea_asignada = models.BooleanField(
        default=True,
        verbose_name=_("App: Tarea Asignada")
    )
    app_tarea_actualizada = models.BooleanField(
        default=True,
        verbose_name=_("App: Tarea Actualizada")
    )
    app_mencion = models.BooleanField(
        default=True,
        verbose_name=_("App: Menciones")
    )
    app_respuesta_comentario = models.BooleanField(
        default=True,
        verbose_name=_("App: Respuestas a Comentarios")
    )
    app_archivo_subido = models.BooleanField(
        default=True,
        verbose_name=_("App: Archivo Subido")
    )
    app_evento_calendario = models.BooleanField(
        default=True,
        verbose_name=_("App: Evento de Calendario")
    )
    app_cambio_rol = models.BooleanField(
        default=True,
        verbose_name=_("App: Cambio de Rol")
    )
    
    # Configuración de horario silencioso
    horario_silencioso_activo = models.BooleanField(
        default=False,
        verbose_name=_("Activar Horario Silencioso")
    )
    horario_silencioso_inicio = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_("Inicio Horario Silencioso"),
        help_text=_("Hora de inicio (ej: 22:00)")
    )
    horario_silencioso_fin = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_("Fin Horario Silencioso"),
        help_text=_("Hora de fin (ej: 08:00)")
    )
    
    # Frecuencia de resúmenes
    frecuencia_resumen = models.CharField(
        max_length=20,
        choices=[
            ('INMEDIATO', _('Inmediato')),
            ('DIARIO', _('Resumen Diario')),
            ('SEMANAL', _('Resumen Semanal')),
        ],
        default='INMEDIATO',
        verbose_name=_("Frecuencia de Notificaciones")
    )

    class Meta:
        verbose_name = _("Preferencias de Notificación")
        verbose_name_plural = _("Preferencias de Notificaciones")

    def __str__(self):
        return f"Preferencias de {self.usuario.username}"