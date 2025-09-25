import uuid
from django.db import models
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