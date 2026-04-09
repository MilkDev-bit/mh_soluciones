"""
Management command to merge duplicate Google Drive folders with the same name.

When multiple folders with the same name exist under the same parent in Google Drive
(usually caused by race conditions during parallel uploads), this command:
  1. Identifies the oldest folder as primary (same deterministic choice as _get_or_create_folder).
  2. Moves all files and subfolders from duplicate folders into the primary folder.
  3. Trashes the now-empty duplicate folders.
  4. Updates Document DB records whose drive_parent_folder_id pointed to a trashed duplicate.

Usage:
    python manage.py merge_drive_duplicate_folders
    python manage.py merge_drive_duplicate_folders --dry-run
    python manage.py merge_drive_duplicate_folders --project-id 47
    python manage.py merge_drive_duplicate_folders --year 2026
    python manage.py merge_drive_duplicate_folders --recursive
"""
import logging
from datetime import datetime
from collections import defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand
from googleapiclient.errors import HttpError

from apps.documents.models import Document
from apps.documents.services import GoogleDriveService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Unifica carpetas duplicadas con el mismo nombre en Google Drive para todos los proyectos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Solo imprime lo que haría, sin escribir en Drive ni en DB',
        )
        parser.add_argument(
            '--project-id',
            type=int,
            dest='project_id',
            help='Procesar solo un proyecto específico (por ID)',
        )
        parser.add_argument(
            '--year',
            type=str,
            default=None,
            help='Año a procesar (default: año actual)',
        )
        parser.add_argument(
            '--recursive',
            action='store_true',
            help='También procesa subcarpetas anidadas dentro de la carpeta del proyecto (default: False)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        project_id = options.get('project_id')
        year = options.get('year') or datetime.now().strftime('%Y')
        recursive = options['recursive']

        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no se harán cambios en Drive ni en la DB'))

        # Initialize Drive service
        try:
            drive_service = GoogleDriveService(use_institutional=True)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error al inicializar el servicio de Google Drive: {e}'))
            return

        # Load projects
        from apps.projects.models import Project
        if project_id:
            projects = Project.objects.filter(id=project_id)
            if not projects.exists():
                self.stderr.write(self.style.ERROR(f'No se encontró el proyecto con ID={project_id}'))
                return
        else:
            projects = Project.objects.all()

        total_projects = projects.count()
        self.stdout.write(f'Procesando {total_projects} proyecto(s) para el año {year}...')

        # Global counters
        total_folders_processed = 0
        total_merged = 0
        total_files_moved = 0
        total_db_updated = 0

        # Get the year folder ID once
        try:
            year_folder_id = drive_service._get_or_create_folder(
                year,
                parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID,
            )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Error al obtener carpeta de año "{year}": {e}'))
            return

        for project in projects:
            self.stdout.write(f'\nProyecto: {project.name} (ID={project.id})')
            try:
                # Navigate to the project folder
                project_folder_id = drive_service._get_or_create_folder(
                    project.name,
                    parent_id=year_folder_id,
                )
                self.stdout.write(f'  Carpeta del proyecto: {project_folder_id}')

                p_processed, p_merged, p_files_moved, p_db_updated = self._process_folder(
                    drive_service=drive_service,
                    folder_id=project_folder_id,
                    dry_run=dry_run,
                    recursive=recursive,
                    indent='  ',
                )
                total_folders_processed += p_processed
                total_merged += p_merged
                total_files_moved += p_files_moved
                total_db_updated += p_db_updated

            except Exception as e:
                self.stderr.write(
                    self.style.ERROR(f'  ERROR procesando proyecto {project.name} (ID={project.id}): {e}')
                )
                continue

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Resumen final:\n'
            f'  Carpetas inspeccionadas:    {total_folders_processed}\n'
            f'  Grupos de duplicados:       {total_merged}\n'
            f'  Archivos movidos:           {total_files_moved}\n'
            f'  Registros DB actualizados:  {total_db_updated}'
        ))
        if dry_run and (total_merged > 0 or total_files_moved > 0):
            self.stdout.write(
                self.style.WARNING('Ejecuta sin --dry-run para aplicar los cambios.')
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _list_children(self, drive_service, parent_id, only_folders=False):
        """Returns all (non-trashed) children of *parent_id*.

        If *only_folders* is True, restricts to folder mime-type.
        """
        items = []
        page_token = None
        mime_filter = "mimeType='application/vnd.google-apps.folder'" if only_folders else \
                      "mimeType!='application/vnd.google-apps.folder'"
        query = f"{mime_filter} and '{parent_id}' in parents and trashed=false"

        while True:
            kwargs = dict(
                q=query,
                spaces='drive',
                fields='nextPageToken, files(id, name, createdTime, mimeType)',
                orderBy='createdTime',
            )
            if page_token:
                kwargs['pageToken'] = page_token
            response = drive_service.service.files().list(**kwargs).execute()
            items.extend(response.get('files', []))
            page_token = response.get('nextPageToken')
            if not page_token:
                break
        return items

    def _process_folder(self, drive_service, folder_id, dry_run, recursive, indent=''):
        """Process one folder level: detect duplicates and merge them.

        Returns (folders_processed, groups_merged, files_moved, db_updated).
        """
        folders_processed = 0
        groups_merged = 0
        files_moved = 0
        db_updated = 0

        # List all subfolders
        try:
            subfolders = self._list_children(drive_service, folder_id, only_folders=True)
        except HttpError as e:
            self.stderr.write(self.style.ERROR(f'{indent}Error listando subcarpetas de {folder_id}: {e}'))
            return folders_processed, groups_merged, files_moved, db_updated

        folders_processed += len(subfolders)

        # Group by name (case-insensitive key, but keep original name)
        groups = defaultdict(list)
        for folder in subfolders:
            groups[folder['name'].lower()].append(folder)

        for name_lower, group in groups.items():
            if len(group) <= 1:
                # No duplicates — recurse if requested
                if recursive and group:
                    r_p, r_m, r_f, r_db = self._process_folder(
                        drive_service, group[0]['id'], dry_run, recursive, indent + '  '
                    )
                    folders_processed += r_p
                    groups_merged += r_m
                    files_moved += r_f
                    db_updated += r_db
                continue

            # Sort by createdTime ascending → oldest first (primary)
            group.sort(key=lambda f: f.get('createdTime', ''))
            primary = group[0]
            duplicates = group[1:]
            display_name = group[0]['name']

            self.stdout.write(
                self.style.WARNING(
                    f'{indent}Duplicados encontrados para "{display_name}": '
                    f'{len(group)} carpetas — primaria: {primary["id"]}'
                )
            )

            for dup in duplicates:
                dup_id = dup['id']
                self.stdout.write(f'{indent}  Procesando duplicada: {dup_id} (creada {dup.get("createdTime")})')

                m_f, m_db = self._merge_into_primary(
                    drive_service=drive_service,
                    primary_id=primary['id'],
                    dup_id=dup_id,
                    dry_run=dry_run,
                    indent=indent + '    ',
                )
                files_moved += m_f
                db_updated += m_db

            groups_merged += 1

            # After merging, recurse into primary if --recursive
            if recursive:
                r_p, r_m, r_f, r_db = self._process_folder(
                    drive_service, primary['id'], dry_run, recursive, indent + '  '
                )
                folders_processed += r_p
                groups_merged += r_m
                files_moved += r_f
                db_updated += r_db

        return folders_processed, groups_merged, files_moved, db_updated

    def _merge_into_primary(self, drive_service, primary_id, dup_id, dry_run, indent=''):
        """Move all contents of *dup_id* into *primary_id*, then trash *dup_id*.

        Returns (files_moved, db_records_updated).
        """
        files_moved = 0
        db_updated = 0
        service = drive_service.service

        # 1. Move regular files
        try:
            files = self._list_children(drive_service, dup_id, only_folders=False)
        except HttpError as e:
            self.stderr.write(self.style.ERROR(f'{indent}Error listando archivos de {dup_id}: {e}'))
            files = []

        for f in files:
            self.stdout.write(f'{indent}Moviendo archivo: {f["name"]} ({f["id"]})')
            if not dry_run:
                try:
                    service.files().update(
                        fileId=f['id'],
                        addParents=primary_id,
                        removeParents=dup_id,
                        fields='id, parents',
                    ).execute()
                    files_moved += 1
                except HttpError as e:
                    self.stderr.write(self.style.ERROR(f'{indent}  Error moviendo archivo {f["id"]}: {e}'))
            else:
                files_moved += 1

        # 2. Move subfolders
        try:
            subfolders = self._list_children(drive_service, dup_id, only_folders=True)
        except HttpError as e:
            self.stderr.write(self.style.ERROR(f'{indent}Error listando subcarpetas de {dup_id}: {e}'))
            subfolders = []

        for folder in subfolders:
            self.stdout.write(f'{indent}Moviendo subcarpeta: {folder["name"]} ({folder["id"]})')
            if not dry_run:
                try:
                    service.files().update(
                        fileId=folder['id'],
                        addParents=primary_id,
                        removeParents=dup_id,
                        fields='id, parents',
                    ).execute()
                    files_moved += 1
                except HttpError as e:
                    self.stderr.write(
                        self.style.ERROR(f'{indent}  Error moviendo subcarpeta {folder["id"]}: {e}')
                    )
            else:
                files_moved += 1

        # 3. Trash the now-empty duplicate folder
        self.stdout.write(f'{indent}Enviando a papelera carpeta duplicada: {dup_id}')
        if not dry_run:
            try:
                service.files().update(
                    fileId=dup_id,
                    body={'trashed': True},
                    fields='id, trashed',
                ).execute()
            except HttpError as e:
                self.stderr.write(self.style.ERROR(f'{indent}  Error al borrar carpeta {dup_id}: {e}'))

        # 4. Update DB records pointing to the duplicate folder
        affected = Document.objects.filter(drive_parent_folder_id=dup_id)
        count = affected.count()
        if count:
            self.stdout.write(
                f'{indent}Actualizando {count} registro(s) DB con drive_parent_folder_id={dup_id} → {primary_id}'
            )
            if not dry_run:
                affected.update(drive_parent_folder_id=primary_id)
            db_updated += count

        return files_moved, db_updated
