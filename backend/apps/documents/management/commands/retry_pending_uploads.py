"""
Management command to retry uploading pending documents to Google Drive.

Documents with upload_status='PENDING' that were never uploaded (e.g. because the
physical file only exists on the Railway server) can be retried with this command.

Usage:
    python manage.py retry_pending_uploads
    python manage.py retry_pending_uploads --dry-run    # List pending documents without uploading
"""
import logging

from django.core.management.base import BaseCommand

from apps.documents.models import Document

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Retry uploading documents with upload_status=PENDING to Google Drive. '
        'Idempotent: only processes documents that are still pending.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='List pending documents without uploading them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        pending_docs = Document.objects.filter(
            upload_status=Document.UploadStatus.PENDING
        ).select_related('project', 'task', 'uploaded_by')

        total = pending_docs.count()

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no se subirán archivos'))
            if total == 0:
                self.stdout.write(self.style.SUCCESS('No hay documentos pendientes.'))
                return
            self.stdout.write(f'Documentos pendientes de subir: {total}')
            for doc in pending_docs:
                project_name = doc.project.name if doc.project else 'Sin proyecto'
                self.stdout.write(f'  ID={doc.id} | {doc.name} | Proyecto: {project_name}')
            return

        if total == 0:
            self.stdout.write(self.style.SUCCESS('No hay documentos pendientes. Nada que hacer.'))
            return

        self.stdout.write(f'Reintentando subida de {total} documento(s) pendiente(s)...')

        uploaded = 0
        failed = 0

        for doc in pending_docs:
            project_name = doc.project.name if doc.project else 'Sin proyecto'
            self.stdout.write(f'  Subiendo ID={doc.id} | {doc.name} | Proyecto: {project_name}...')
            try:
                result = doc.upload_to_drive()
                if result:
                    self.stdout.write(self.style.SUCCESS(f'    ✅ Subido correctamente'))
                    uploaded += 1
                else:
                    self.stderr.write(
                        self.style.ERROR(f'    ❌ Falló la subida (sin excepción)')
                    )
                    logger.error('retry_pending_uploads: falló sin excepción para doc ID=%s (%s)', doc.id, doc.name)
                    failed += 1
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'    ❌ Error: {e}'))
                logger.exception('retry_pending_uploads: error al subir doc ID=%s (%s)', doc.id, doc.name)
                failed += 1

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(f'Resumen: {uploaded} subidos correctamente, {failed} fallidos.')
        )
