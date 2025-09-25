from celery import shared_task
from .models import Document
from .services import GoogleDriveService

@shared_task(name="upload_document_to_drive_task", bind=True, max_retries=3, default_retry_delay=300)
def upload_document_to_drive(self, document_id):
    """
    Tarea de Celery para subir un archivo a Google Drive de forma asíncrona.

    Args:
        document_id (int): El ID de la instancia del Documento a subir.
    """
    try:
        document = Document.objects.get(pk=document_id)
        
        document.upload_status = Document.UploadStatus.UPLOADING
        document.save(update_fields=['upload_status'])

        if not document.uploaded_by:
            raise ValueError("El documento no tiene un propietario (uploaded_by) para inicializar el servicio de Google Drive.")

        drive_service = GoogleDriveService(user=document.uploaded_by)

        if not drive_service.service:
            raise ConnectionError("No se pudo inicializar el servicio de Google Drive. El usuario podría no tener credenciales vinculadas.")

        gdrive_file_info = drive_service.upload_document(document)

        if gdrive_file_info:
            document.drive_file_id = gdrive_file_info.get('id')
            document.drive_file_url = gdrive_file_info.get('webViewLink')
            document.upload_status = Document.UploadStatus.COMPLETE
            document.save(update_fields=['drive_file_id', 'drive_file_url', 'upload_status'])
            return f"Archivo {document_id} subido exitosamente a Google Drive."
        else:
            raise ValueError("La subida a Google Drive falló, el servicio no devolvió información del archivo.")

    except Document.DoesNotExist:
        return f"Error: Documento con id {document_id} no encontrado. No se puede subir."
    except Exception as exc:
        try:
            failed_doc = Document.objects.get(pk=document_id)
            failed_doc.upload_status = Document.UploadStatus.FAILED
            failed_doc.save(update_fields=['upload_status'])
        except Document.DoesNotExist:
            pass

        print(f"Error al subir el archivo {document_id}: {exc}. Reintentando...")
        self.retry(exc=exc)

    return f"La tarea de subida para el archivo {document_id} falló después de todos los reintentos."