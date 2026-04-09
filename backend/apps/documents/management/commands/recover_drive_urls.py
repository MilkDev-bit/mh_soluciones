"""
Management command to recover Google Drive URLs for documents that were uploaded
but whose drive_file_id/drive_file_url were never saved to the database (due to a bug
where _upload_to_google_drive() did not call self.save() after success).

Usage:
    python manage.py recover_drive_urls
    python manage.py recover_drive_urls --dry-run
    python manage.py recover_drive_urls --doc-ids 731 732 733
"""
import logging
import os

from django.db.models import Q
from django.core.management.base import BaseCommand

from apps.documents.models import Document
from apps.documents.services import GoogleDriveService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Recover Google Drive file IDs and URLs for documents that are COMPLETE '
        'but missing drive_file_id in the database.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be updated without making changes',
        )
        parser.add_argument(
            '--doc-ids',
            nargs='+',
            type=int,
            help='Only process specific document IDs',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        doc_ids = options.get('doc_ids')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no se haran cambios en la BD'))

        # Find documents that are COMPLETE but have no drive_file_id
        qs = Document.objects.filter(
            upload_status=Document.UploadStatus.COMPLETE,
        ).filter(
            Q(drive_file_id__isnull=True) | Q(drive_file_id='')
        ).select_related('project', 'task', 'uploaded_by')

        if doc_ids:
            qs = qs.filter(id__in=doc_ids)

        total = qs.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS('No hay documentos afectados. Todo esta en orden.'))
            return

        self.stdout.write(f'Documentos afectados (COMPLETE sin drive_file_id): {total}')

        # Initialize Drive service
        try:
            drive_service = GoogleDriveService(use_institutional=True)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error al inicializar Google Drive: {e}'))
            return

        recovered = 0
        not_found = 0
        errors = 0

        for doc in qs:
            project_name = doc.project.name if doc.project else 'Sin proyecto'
            self.stdout.write(
                f'  Buscando ID={doc.id} | {doc.name} | Proyecto: {project_name}...'
            )

            try:
                # Build list of names to search in Drive
                search_names = []
                if doc.file and doc.file.name:
                    search_names.append(os.path.basename(doc.file.name))
                if doc.name and doc.name not in search_names:
                    search_names.append(doc.name)

                found_file = None
                for search_name in search_names:
                    # Escape single quotes in filename for the Drive query
                    safe_name = search_name.replace("'", "\\'")
                    query = (
                        f"name='{safe_name}' and trashed=false "
                        f"and mimeType!='application/vnd.google-apps.folder'"
                    )
                    try:
                        response = drive_service.service.files().list(
                            q=query,
                            spaces='drive',
                            fields='files(id, name, webViewLink, parents, mimeType)',
                            orderBy='createdTime desc',
                            pageSize=10,
                        ).execute()
                        files = response.get('files', [])
                        if files:
                            found_file = files[0]  # Most recent match
                            break
                    except Exception as search_err:
                        logger.warning(
                            'recover_drive_urls: error buscando "%s" en Drive: %s',
                            search_name, search_err,
                        )
                        continue

                if found_file:
                    drive_file_id = found_file.get('id')
                    drive_file_url = found_file.get('webViewLink')
                    parents = found_file.get('parents') or []
                    parent_folder_id = parents[0] if parents else None

                    # Resolve parent folder name
                    parent_folder_name = None
                    if parent_folder_id:
                        try:
                            folder_meta = drive_service.service.files().get(
                                fileId=parent_folder_id,
                                fields='id, name',
                            ).execute()
                            parent_folder_name = folder_meta.get('name')
                        except Exception:
                            pass

                    self.stdout.write(
                        self.style.SUCCESS(
                            f'    Encontrado: {drive_file_id} | {drive_file_url}'
                        )
                    )

                    if not dry_run:
                        doc.drive_file_id = drive_file_id
                        doc.drive_file_url = drive_file_url
                        doc.drive_parent_folder_id = parent_folder_id
                        doc.drive_parent_folder_name = parent_folder_name
                        doc.save(update_fields=[
                            'drive_file_id',
                            'drive_file_url',
                            'drive_parent_folder_id',
                            'drive_parent_folder_name',
                        ])
                    recovered += 1
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'    No encontrado en Drive (nombres buscados: {search_names})'
                        )
                    )
                    not_found += 1

            except Exception as e:
                self.stderr.write(self.style.ERROR(f'    Error: {e}'))
                logger.exception(
                    'recover_drive_urls: error procesando doc ID=%s (%s)', doc.id, doc.name
                )
                errors += 1

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Resumen: {recovered} recuperados, {not_found} no encontrados en Drive, {errors} errores.'
            )
        )
        if dry_run and recovered > 0:
            self.stdout.write(
                self.style.WARNING('Ejecuta sin --dry-run para aplicar los cambios.')
            )
