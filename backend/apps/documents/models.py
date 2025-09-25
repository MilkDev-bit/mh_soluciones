import os
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.core.utils import get_document_upload_path

class Document(TimeStampedModel):
    """
    Modelo para representar un documento subido al sistema.
    """
    class UploadStatus(models.TextChoices):
        PENDING = 'PENDING', _('Pendiente')
        UPLOADING = 'UPLOADING', _('Subiendo')
        COMPLETE = 'COMPLETE', _('Completo')
        FAILED = 'FAILED', _('Fallido')

    class FolderType(models.TextChoices):
        OPERATIVO = 'OPERATIVO', _('Operativo')
        ADMINISTRATIVO = 'ADMINISTRATIVO', _('Administrativo')

    folder_type = models.CharField(
        max_length=20,
        choices=FolderType.choices,
        default=FolderType.OPERATIVO,
        verbose_name=_("Tipo de Carpeta")
    )

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_("Subido por")
    )
    project = models.ForeignKey(
        'projects.Project', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    task = models.ForeignKey(
        'tasks.Task', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True
    )
    file = models.FileField(
        upload_to=get_document_upload_path,
        verbose_name=_("Archivo")
    )
    name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_("Nombre del Documento (Automático)")
    )
    file_size = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name=_("Tamaño del Archivo (bytes)")
    )
    upload_status = models.CharField(
        max_length=20,
        choices=UploadStatus.choices,
        default=UploadStatus.PENDING,
        verbose_name=_("Estado de Subida a Drive")
    )
    drive_file_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name=_("ID del Archivo en Google Drive")
    )
    drive_file_url = models.URLField(
        blank=True,
        null=True,
        verbose_name=_("URL del Archivo en Google Drive")
    )
    notes = models.TextField(
        blank=True,
        null=True,
        verbose_name=_("Notas del documento")
    )

    class Meta:
        verbose_name = _("Documento")
        verbose_name_plural = _("Documentos")
        ordering = ['-created_at']

    def __str__(self):
        return self.name or self.file.name or "Documento sin nombre"

    def save(self, *args, **kwargs):
        if self.file and not self.name:
            self.name = os.path.basename(self.file.name)
        
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except (ValueError, OSError):
                self.file_size = 0

        super().save(*args, **kwargs)