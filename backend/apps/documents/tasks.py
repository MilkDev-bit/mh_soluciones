import logging

from celery import shared_task
from .models import Document
from .services import GoogleDriveService

logger = logging.getLogger(__name__)


@shared_task(name="upload_document_to_drive_task", bind=True, max_retries=3, default_retry_delay=300)
def upload_document_to_drive(self, document_id, target_folder_id=None):
    """
    Tarea de Celery para subir un archivo a Google Drive institucional.
    También puede llamarse directamente (sin Celery) para subida síncrona.
    """
    try:
        document = Document.objects.get(pk=document_id)

        document.upload_status = Document.UploadStatus.UPLOADING
        document.save(update_fields=['upload_status'])

        try:
            drive_service = GoogleDriveService(use_institutional=True)
        except ValueError as e:
            error_msg = (
                f"Error de configuración de Google Drive institucional: {e}. "
                "Verifica que GOOGLE_DRIVE_ADMIN_USER_ID esté configurado y que el usuario admin "
                "haya conectado su cuenta de Google Drive."
            )
            logger.error(error_msg)
            document.upload_status = Document.UploadStatus.FAILED
            document.save(update_fields=['upload_status'])
            return error_msg

        if not drive_service.service:
            raise ConnectionError("No se pudo inicializar el servicio de Google Drive institucional.")

        gdrive_file_info = drive_service.upload_document(document, target_folder_id=target_folder_id)

        if gdrive_file_info:
            document.drive_file_id = gdrive_file_info.get('id')
            document.drive_file_url = gdrive_file_info.get('webViewLink')
            document.drive_parent_folder_id = gdrive_file_info.get('parent_folder_id')
            document.drive_parent_folder_name = gdrive_file_info.get('parent_folder_name')
            document.upload_status = Document.UploadStatus.COMPLETE
            document.save(update_fields=[
                'drive_file_id', 'drive_file_url', 'upload_status',
                'drive_parent_folder_id', 'drive_parent_folder_name'
            ])
            logger.info(f"✅ Documento {document_id} subido exitosamente a Google Drive.")
            return f"Archivo {document_id} subido exitosamente a Google Drive institucional."
        else:
            raise ValueError("La subida a Google Drive falló, el servicio no devolvió información del archivo.")

    except Document.DoesNotExist:
        return f"Error: Documento con id {document_id} no encontrado. No se puede subir."
    except Exception as exc:
        logger.error(f"Error al subir el archivo {document_id}: {exc}")
        try:
            failed_doc = Document.objects.get(pk=document_id)
            failed_doc.upload_status = Document.UploadStatus.FAILED
            failed_doc.save(update_fields=['upload_status'])
        except Document.DoesNotExist:
            pass

        # Solo reintentar si se está ejecutando como tarea Celery (self.request.id no es None)
        if self.request.id is not None:
            logger.info(f"Reintentando tarea Celery para documento {document_id}...")
            raise self.retry(exc=exc)

        return f"Error al subir archivo {document_id}: {exc}"