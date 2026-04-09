import os
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.core.utils import get_document_upload_path
from apps.core.validators import validate_file_extension
from .services import GoogleDriveService

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
        DOCUMENTOS = 'DOCUMENTOS', _('Documentos')
        IMAGENES = 'IMAGENES', _('Imágenes')
        VIDEOS = 'VIDEOS', _('Videos')
        ARCHIVOS = 'ARCHIVOS', _('Archivos')
        TASK_SUBMISSION = 'TASK_SUBMISSION', _('Entrega de Tarea')
        OTROS = 'OTROS', _('Otros')

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
        blank=True,
        related_name='documents'
    )
    task = models.ForeignKey(
        'tasks.Task', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name='documents'
    )
    task_submission = models.ForeignKey(
        'tasks.TaskSubmission',
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True,
        verbose_name=_("Entrega de Tarea"),
        help_text=_("Entrega de tarea asociada")
    )
    file = models.FileField(
        upload_to=get_document_upload_path,
        validators=[validate_file_extension],
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
    file_type = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_("Tipo de Archivo")
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
    drive_parent_folder_id = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name=_("ID de la Carpeta Padre en Google Drive")
    )
    drive_parent_folder_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name=_("Nombre de la Carpeta Padre en Google Drive")
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

    def get_file_extension(self):
        """Obtiene la extensión del archivo"""
        if self.file and self.file.name:
            return os.path.splitext(self.file.name)[1].lower()
        return ''

    def _get_folder_type_for_drive(self):
        """Mapea el tipo de carpeta para la estructura de Google Drive"""
        folder_mapping = {
            'OPERATIVO': 'Operativo',
            'ADMINISTRATIVO': 'Administrativo',
            'DOCUMENTOS': 'Documentos',
            'IMAGENES': 'Imágenes',
            'VIDEOS': 'Videos',
            'ARCHIVOS': 'Archivos',
            'TASK_SUBMISSION': 'Entregas',
            'OTROS': 'Otros',
        }
        return folder_mapping.get(self.folder_type, 'Documentos')

    def _upload_to_google_drive(self):
        """Sube el archivo a Google Drive institucional"""
        try:
            if not self.file:
                print("❌ No hay archivo para subir")
                return False

            self.upload_status = Document.UploadStatus.UPLOADING
            self.save(update_fields=['upload_status'])

            print(f"📤 Iniciando subida a Google Drive institucional: {self.name}")

            # ✅ Usar credenciales institucionales
            try:
                drive_service = GoogleDriveService(use_institutional=True)
            except ValueError as e:
                # Error de configuración - no reintentar
                self.upload_status = Document.UploadStatus.FAILED
                self.save(update_fields=['upload_status'])
                error_msg = (
                    f"Error de configuración: {e}. "
                    "Verifica que GOOGLE_DRIVE_ADMIN_USER_ID esté configurado correctamente."
                )
                print(f"❌ {error_msg}")
                return False
            
            result = drive_service.upload_document(self)
            
            if result:
                self.drive_file_id = result.get('id')
                self.drive_file_url = result.get('webViewLink')
                self.drive_parent_folder_id = result.get('parent_folder_id')
                self.drive_parent_folder_name = result.get('parent_folder_name')
                self.upload_status = Document.UploadStatus.COMPLETE
                self.save(update_fields=[
                    'drive_file_id',
                    'drive_file_url',
                    'drive_parent_folder_id',
                    'drive_parent_folder_name',
                    'upload_status',
                ])
                
                print(f"✅ Archivo subido exitosamente a Google Drive institucional")
                print(f"🔗 Enlace: {self.drive_file_url}")
                print(f"🆔 ID: {self.drive_file_id}")
                
                return True
            else:
                self.upload_status = Document.UploadStatus.FAILED
                self.save(update_fields=['upload_status'])
                print("❌ Falló la subida a Google Drive")
                return False

        except Exception as e:
            self.upload_status = Document.UploadStatus.FAILED
            self.save(update_fields=['upload_status'])
            print(f"❌ Error en la subida a Google Drive: {e}")
            import traceback
            traceback.print_exc()
            return False

    def save(self, *args, **kwargs):
        if self.file and not self.name:
            self.name = os.path.basename(self.file.name)
        
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except (ValueError, OSError):
                self.file_size = 0

        if self.file and not self.file_type:
            try:
                if hasattr(self.file, 'file') and hasattr(self.file.file, 'content_type'):
                    self.file_type = self.file.file.content_type
                else:
                    self.file_type = 'application/octet-stream'
            except (AttributeError, ValueError):
                self.file_type = 'application/octet-stream'

        is_new = not self.pk 
        super().save(*args, **kwargs)

    def upload_to_drive(self):
        """
        Método para forzar la subida a Google Drive manualmente
        """
        return self._upload_to_google_drive()

    def get_drive_status_display(self):
        """Muestra el estado de subida a Drive de forma legible"""
        status_map = {
            'PENDING': '⏳ Pendiente',
            'UPLOADING': '📤 Subiendo...',
            'COMPLETE': '✅ En Drive',
            'FAILED': '❌ Falló'
        }
        return status_map.get(self.upload_status, self.upload_status)

    @property
    def is_in_google_drive(self):
        """Verifica si el archivo está en Google Drive"""
        return self.upload_status == Document.UploadStatus.COMPLETE and bool(self.drive_file_id)

    @property
    def display_size(self):
        """Muestra el tamaño del archivo en formato legible"""
        if not self.file_size:
            return "0 B"
        
        for unit in ['B', 'KB', 'MB', 'GB']:
            if self.file_size < 1024.0:
                return f"{self.file_size:.1f} {unit}"
            self.file_size /= 1024.0
        return f"{self.file_size:.1f} TB"