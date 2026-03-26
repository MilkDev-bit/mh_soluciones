"""
Management command to inspect and recover task submission files.

Usage on Railway console:
  python manage.py recover_submission_files
  python manage.py recover_submission_files --date 2026-03-26
  python manage.py recover_submission_files --submission-id 5
  python manage.py recover_submission_files --retry-drive   (re-uploads FAILED/PENDING docs to Drive)
"""
import sys
import types

# Mock modules that may not be installed or have system dependencies in production
for mod_name in ['magic', 'pyclamd']:
    if mod_name not in sys.modules:
        mock = types.ModuleType(mod_name)
        mock.from_buffer = lambda *a, **kw: 'application/octet-stream'
        mock.ClamdUnixSocket = lambda *a, **kw: None
        mock.ClamdNetworkSocket = lambda *a, **kw: None
        mock.ConnectionError = Exception
        sys.modules[mod_name] = mock

import os
import logging
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Inspect and recover task submission files (check Drive upload status and re-upload if needed)'

    def add_arguments(self, parser):
        parser.add_argument('--date', type=str, default=None,
                            help='Date to check (YYYY-MM-DD). Defaults to today.')
        parser.add_argument('--submission-id', type=int, default=None,
                            help='Check a specific submission by ID.')
        parser.add_argument('--retry-drive', action='store_true', default=False,
                            help='Re-upload to Drive any documents with FAILED or PENDING status.')
        parser.add_argument('--all-pending', action='store_true', default=False,
                            help='Process all submissions with pending/failed docs (last 7 days).')

    def handle(self, *args, **options):
        from apps.tasks.models import TaskSubmission
        from apps.documents.models import Document

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('  RECOVERY TOOL - Submission File Inspector'))
        self.stdout.write(self.style.SUCCESS('=' * 60 + '\n'))

        # --- Determine filter date ---
        if options['submission_id']:
            try:
                submissions = TaskSubmission.objects.filter(id=options['submission_id'])
                if not submissions.exists():
                    self.stdout.write(self.style.ERROR(f"No submission found with ID {options['submission_id']}"))
                    return
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error: {e}"))
                return
        elif options['all_pending']:
            since = timezone.now() - timedelta(days=7)
            submissions = TaskSubmission.objects.filter(created_at__gte=since)
        else:
            target_date = date.today()
            if options['date']:
                from datetime import datetime
                target_date = datetime.strptime(options['date'], '%Y-%m-%d').date()
            submissions = TaskSubmission.objects.filter(created_at__date=target_date)

        submissions = submissions.select_related(
            'submitted_by', 'task', 'task__project'
        ).prefetch_related('documents').order_by('-created_at')

        if not submissions.exists():
            self.stdout.write(self.style.WARNING('No submissions found for the given filter.'))
            return

        self.stdout.write(f"Found {submissions.count()} submission(s):\n")

        for sub in submissions:
            self._display_submission(sub, options['retry_drive'])

        # Summary of all failing documents
        self.stdout.write('\n' + '=' * 60)
        self.stdout.write(self.style.WARNING('DOCUMENTS STATUS SUMMARY'))
        self.stdout.write('=' * 60)

        # Get all docs from these submissions
        sub_ids = [s.id for s in submissions]
        all_docs = Document.objects.filter(task_submission_id__in=sub_ids)
        
        for status in ['COMPLETE', 'PENDING', 'UPLOADING', 'FAILED']:
            count = all_docs.filter(upload_status=status).count()
            if count:
                icon = {'COMPLETE': '✅', 'PENDING': '⏳', 'UPLOADING': '📤', 'FAILED': '❌'}.get(status, '?')
                self.stdout.write(f"  {icon} {status}: {count}")

        if not all_docs.exists():
            self.stdout.write(self.style.WARNING("  ⚠️  No Document objects found for these submissions!"))
            self.stdout.write("  This means the file was NOT saved via the Document model.")
            self.stdout.write("  Check submission.file, submission.google_drive_link fields above.")

    def _display_submission(self, sub, retry_drive=False):
        self.stdout.write(self.style.HTTP_INFO(
            f"\n📋 Submission #{sub.id} | {sub.task.title}"
        ))
        proj = sub.task.project.name if sub.task.project else 'Sin proyecto'
        self.stdout.write(f"   Proyecto: {proj}")
        self.stdout.write(f"   Estudiante: {sub.submitted_by.get_full_name()} ({sub.submitted_by.email})")
        self.stdout.write(f"   Fecha: {sub.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        self.stdout.write(f"   Estado: {sub.status} | Versión: v{sub.version}")

        # Check all possible file sources
        self.stdout.write(f"\n   --- Fuentes de archivos ---")

        # Source 1: Document objects
        docs = sub.documents.all()
        if docs.exists():
            self.stdout.write(f"   📎 Documentos (FK): {docs.count()} encontrado(s)")
            for doc in docs:
                icon = {'COMPLETE': '✅', 'PENDING': '⏳', 'UPLOADING': '📤', 'FAILED': '❌'}.get(doc.upload_status, '?')
                self.stdout.write(f"      {icon} [{doc.upload_status}] Doc #{doc.id}: {doc.name}")
                # Check if file exists on disk
                if doc.file:
                    try:
                        exists = bool(doc.file.size > 0)
                        self.stdout.write(f"         Archivo local: {doc.file.name} ({'✅ existe' if exists else '❌ no encontrado'})")
                    except Exception:
                        self.stdout.write(f"         Archivo local: {doc.file.name} [⚠️ no accesible]")
                if doc.drive_file_url:
                    self.stdout.write(f"         Drive URL: {doc.drive_file_url}")
                else:
                    self.stdout.write(f"         Drive URL: ❌ No disponible")

                # Retry drive upload if requested
                if retry_drive and doc.upload_status in ('FAILED', 'PENDING'):
                    self._retry_document_upload(doc, sub)
        else:
            self.stdout.write(f"   📎 Documentos (FK): ❌ Ninguno")

        # Source 2: files_metadata
        if sub.files_metadata:
            self.stdout.write(f"   📊 files_metadata: {len(sub.files_metadata)} entrada(s)")
            for fm in sub.files_metadata:
                link = fm.get('web_view_link', '❌ sin link')
                self.stdout.write(f"      - {fm.get('name','?')}: {link}")
        else:
            self.stdout.write(f"   📊 files_metadata: ❌ Vacío")

        # Source 3: direct google_drive_link
        if sub.google_drive_link:
            self.stdout.write(f"   🔗 google_drive_link: {sub.google_drive_link}")
        else:
            self.stdout.write(f"   🔗 google_drive_link: ❌ No disponible")

        # Source 4: direct file field
        if sub.file:
            self.stdout.write(f"   📄 file (directo): {sub.file.name}")
            try:
                size = sub.file.size
                self.stdout.write(f"      Tamaño: {size / 1024:.1f} KB ✅")
            except Exception:
                self.stdout.write(f"      ⚠️ Archivo no accesible")
        else:
            self.stdout.write(f"   📄 file (directo): ❌ No disponible")

    def _retry_document_upload(self, doc, submission):
        from apps.documents.services import GoogleDriveService
        from apps.tasks.api.views import TaskSubmissionViewSet

        self.stdout.write(self.style.WARNING(
            f"         🔄 Reintentando subida a Drive para Doc #{doc.id}..."
        ))
        try:
            # Use institutional credentials
            drive_service = GoogleDriveService(use_institutional=True)
            
            # Use the same folder structure logic
            viewset = TaskSubmissionViewSet()
            folder_id = viewset._get_destination_folder(
                drive_service, 
                submission.task, 
                submission.submitted_by, 
                submission
            )
            
            result = drive_service.upload_document(doc, target_folder_id=folder_id)
            
            if result:
                doc.drive_file_url = result.get('webViewLink')
                doc.drive_file_id = result.get('id')
                doc.upload_status = 'COMPLETE'
                doc.save(update_fields=['drive_file_url', 'drive_file_id', 'upload_status'])
                
                # Update submission files_metadata
                if submission.files_metadata is None:
                    submission.files_metadata = []
                # Add entry if not already there
                existing_ids = [fm.get('gdrive_id') for fm in submission.files_metadata]
                if result['id'] not in existing_ids:
                    submission.files_metadata.append({
                        'name': result.get('name', doc.name),
                        'gdrive_id': result['id'],
                        'size': result.get('size', 0),
                        'mime_type': result.get('mimeType', ''),
                        'web_view_link': result.get('webViewLink'),
                        'document_id': doc.id,
                    })
                    submission.save(update_fields=['files_metadata'])
                
                self.stdout.write(self.style.SUCCESS(
                    f"         ✅ Subido exitosamente! URL: {result.get('webViewLink')}"
                ))
            else:
                self.stdout.write(self.style.ERROR(
                    f"         ❌ La subida retornó None. Revisa los logs del servidor."
                ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(
                f"         ❌ Error al reintentar: {e}"
            ))
            import traceback
            self.stdout.write(traceback.format_exc())
