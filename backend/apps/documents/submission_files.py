"""
Eliminación de archivos de una entrega de tarea.

Solo el SUPERADMIN puede borrar un archivo entregado. Se borra en los dos
lados: el archivo se manda a la papelera de Google Drive (se puede recuperar
desde ahí durante 30 días) y el documento se quita de la entrega.

Si Drive falla, no se borra nada en el sistema para que no queden archivos
huérfanos en Drive; se puede volver a intentar.

Si la entrega se queda sin archivos ni enlace, se elimina la entrega completa
para que el alumno ya no la vea y pueda volver a entregar. Si tenía una versión
anterior reemplazada, esa vuelve a ser la vigente.
"""
import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import APIException, PermissionDenied

from apps.core.audit import actor_label, log_activity

from .models import Document
from .services import GoogleDriveService, is_valid_drive_id

logger = logging.getLogger(__name__)

# Una subida que sigue "pendiente" después de esto se considera atorada y ya
# no impide borrar el archivo.
PENDING_UPLOAD_GRACE = timedelta(minutes=15)


class SubmissionFileConflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = 'upload_in_progress'


class DriveDeleteFailed(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = 'drive_delete_failed'


def can_delete_submission_files(user):
    return bool(user and user.is_authenticated and getattr(user, 'role', None) == 'SUPERADMIN')


def _upload_in_progress(document):
    if document.upload_status == Document.UploadStatus.UPLOADING:
        return True
    if document.upload_status == Document.UploadStatus.PENDING and not document.drive_file_id:
        return timezone.now() - document.created_at < PENDING_UPLOAD_GRACE
    return False


def _submission_is_empty(submission):
    """La entrega ya no tiene nada entregado (archivos, enlaces ni archivo directo)."""
    return not (
        submission.documents.exists()
        or submission.link
        or submission.file
        or submission.files_metadata
        or submission.google_drive_file_id
    )


def _restore_previous_version(submission):
    """Vuelve vigente la versión anterior que esta entrega había reemplazado."""
    S = submission.SubmissionStatus
    previous = (submission.__class__.objects
                .filter(task=submission.task, submitted_by=submission.submitted_by,
                        version__lt=submission.version)
                .order_by('-version').first())
    if previous is None or previous.status != S.SUPERSEDED:
        return previous
    # Si ya la había revisado alguien y no se aprobó, se había devuelto con cambios.
    previous.status = S.CHANGES_REQUESTED if previous.graded_at else S.SUBMITTED
    previous.save(update_fields=['status'])
    return previous


def delete_submission_document(document, user):
    """Borra el archivo de la entrega y de Google Drive.

    Devuelve {'deleted_in_drive': bool, 'submission_deleted': bool}.
    """
    if not can_delete_submission_files(user):
        raise PermissionDenied('Solo el superadministrador puede eliminar archivos de una entrega.')
    if _upload_in_progress(document):
        raise SubmissionFileConflict(
            'El archivo todavía se está subiendo a Google Drive. Intenta de nuevo en unos minutos.'
        )

    drive_id = document.drive_file_id if is_valid_drive_id(document.drive_file_id or '') else None
    trashed_in_drive = False
    if drive_id:
        try:
            trashed_in_drive = GoogleDriveService(use_institutional=True).trash_file(drive_id)
        except Exception as exc:
            logger.exception('No se pudo borrar en Drive el archivo %s (documento %s)', drive_id, document.pk)
            raise DriveDeleteFailed(
                'No se pudo borrar el archivo en Google Drive, así que no se eliminó. '
                'Intenta de nuevo en unos minutos.'
            ) from exc

    submission = document.task_submission
    task = submission.task if submission else document.task
    name = document.name or 'archivo'
    document_id = document.pk
    submission_id = submission.pk if submission else None
    submission_deleted = False

    with transaction.atomic():
        if submission is not None and drive_id:
            # Quita las referencias al mismo archivo que guarda la entrega.
            fields = []
            meta = submission.files_metadata or []
            kept = [f for f in meta if not (isinstance(f, dict) and f.get('gdrive_id') == drive_id)]
            if len(kept) != len(meta):
                submission.files_metadata = kept
                fields.append('files_metadata')
            if submission.google_drive_file_id == drive_id:
                submission.google_drive_file_id = None
                submission.google_drive_link = None
                submission.uploaded_to_drive = False
                fields += ['google_drive_file_id', 'google_drive_link', 'uploaded_to_drive']
            if fields:
                submission.save(update_fields=fields)
        stored_file = document.file
        document.delete()

        # Sin nada entregado, la entrega ya no existe para el alumno.
        if submission is not None and _submission_is_empty(submission):
            _restore_previous_version(submission)
            submission.delete()
            submission_deleted = True

    if stored_file:
        try:
            stored_file.delete(save=False)
        except Exception:  # El archivo local es secundario: el de Drive es el oficial.
            logger.warning('No se pudo borrar la copia local de %s', name, exc_info=True)

    student = submission.submitted_by if submission else None
    log_activity(
        'ARCHIVO_ELIMINADO',
        f"{actor_label(user)} eliminó el archivo '{name}' de la entrega"
        + (f" de {actor_label(student)}" if student else '')
        + (f" en la tarea '{task.title}'" if task else '')
        + (' (la entrega quedó vacía y se eliminó)' if submission_deleted else ''),
        user,
        tarea_id=task.id if task else None,
        proyecto_id=task.project_id if task else None,
        metadata={
            'documento_id': document_id,
            'entrega_id': submission_id,
            'entrega_eliminada': submission_deleted,
            'drive_file_id': drive_id,
            'borrado_en_drive': trashed_in_drive,
        },
    )
    return {'deleted_in_drive': trashed_in_drive, 'submission_deleted': submission_deleted}
