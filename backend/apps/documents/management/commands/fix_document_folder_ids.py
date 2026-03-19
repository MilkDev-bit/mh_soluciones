"""
Management command to fix drive_parent_folder_id on existing documents.

Problem: Old documents stored the USER folder ID as drive_parent_folder_id.
The folder dropdown shows TASK folders (direct children of project).
This command updates each document with a task to store the TASK folder ID instead,
so the folder filter works correctly for existing files.

Usage:
    python manage.py fix_document_folder_ids
    python manage.py fix_document_folder_ids --dry-run    # Preview changes without saving
    python manage.py fix_document_folder_ids --project 5  # Only for a specific project
"""
import logging

from django.core.management.base import BaseCommand, CommandError
from googleapiclient.errors import HttpError

from apps.documents.models import Document
from apps.documents.services import GoogleDriveService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Fix drive_parent_folder_id for documents with tasks. '
        'Updates old documents to store the task folder ID instead of the user folder ID, '
        'so the folder filter in the frontend works correctly.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview changes without saving to the database',
        )
        parser.add_argument(
            '--project',
            type=int,
            help='Only process documents from a specific project ID',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        project_id = options.get('project')

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be saved'))

        # --- Documents WITH a task: update drive_parent_folder_id to task folder ---
        docs_with_task = Document.objects.filter(
            task__isnull=False,
            drive_parent_folder_id__isnull=False,
            upload_status='COMPLETE',
        ).select_related('task', 'project')

        if project_id:
            docs_with_task = docs_with_task.filter(project_id=project_id)

        total_with_task = docs_with_task.count()
        self.stdout.write(f'Found {total_with_task} complete documents with task to update')

        if total_with_task == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to update.'))
            return

        # Initialize Drive service
        try:
            drive_service = GoogleDriveService(use_institutional=True)
        except Exception as e:
            raise CommandError(f'Error initializing Google Drive service: {e}')

        updated = 0
        skipped = 0
        errors = 0

        for doc in docs_with_task:
            try:
                # The current drive_parent_folder_id is the USER folder.
                # Its parent is the TASK folder (what the dropdown shows).
                user_folder_info = drive_service.service.files().get(
                    fileId=doc.drive_parent_folder_id,
                    fields='id, name, parents'
                ).execute()

                parents = user_folder_info.get('parents', [])
                if not parents:
                    self.stdout.write(
                        self.style.WARNING(
                            f'  SKIP doc {doc.id} ({doc.name}): user folder has no parent in Drive'
                        )
                    )
                    skipped += 1
                    continue

                task_folder_id = parents[0]

                # Skip if already pointing to the task folder
                if doc.drive_parent_folder_id == task_folder_id:
                    self.stdout.write(f'  SKIP doc {doc.id} ({doc.name}): already correct')
                    skipped += 1
                    continue

                # Get the task folder name
                task_folder_info = drive_service.service.files().get(
                    fileId=task_folder_id,
                    fields='id, name'
                ).execute()
                task_folder_name = task_folder_info.get('name', doc.task.title or 'Tarea')

                self.stdout.write(
                    f'  UPDATE doc {doc.id} ({doc.name}): '
                    f'"{doc.drive_parent_folder_name}" (user) -> '
                    f'"{task_folder_name}" (task folder)'
                )

                if not dry_run:
                    Document.objects.filter(pk=doc.pk).update(
                        drive_parent_folder_id=task_folder_id,
                        drive_parent_folder_name=task_folder_name,
                    )

                updated += 1

            except HttpError as e:
                self.stderr.write(
                    self.style.ERROR(
                        f'  ERROR doc {doc.id} ({doc.name}): '
                        f'Google Drive API error {e.resp.status} - {e}'
                    )
                )
                errors += 1
            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f'  ERROR doc {doc.id} ({doc.name}): {e}')
                )
                errors += 1

        # Summary
        action = 'Would update' if dry_run else 'Updated'
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done: {action} {updated} documents, skipped {skipped}, errors {errors}'
        ))

        if dry_run and updated > 0:
            self.stdout.write(
                self.style.WARNING('Run without --dry-run to apply the changes.')
            )
