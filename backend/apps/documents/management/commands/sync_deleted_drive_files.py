import logging
from django.core.management.base import BaseCommand
from apps.documents.models import Document
from apps.documents.services import GoogleDriveService

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Verifica qué documentos de la BD ya no existen en Google Drive "
        "y los elimina. Útil para limpiar registros huérfanos."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="Muestra qué se borraría sin eliminar nada.",
        )
        parser.add_argument(
            '--project',
            type=int,
            default=None,
            help="Limitar la sincronización a un proyecto específico (ID).",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        project_id = options['project']

        qs = Document.objects.filter(
            upload_status=Document.UploadStatus.COMPLETE,
            drive_file_id__isnull=False,
        ).exclude(drive_file_id='')

        if project_id:
            qs = qs.filter(project_id=project_id)

        docs = list(qs.values_list('id', 'drive_file_id', 'name'))

        if not docs:
            self.stdout.write(self.style.WARNING("No hay documentos sincronizados con Drive para verificar."))
            return

        self.stdout.write(f"Verificando {len(docs)} documentos en Google Drive...")

        try:
            drive_service = GoogleDriveService(use_institutional=True)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"No se pudo conectar a Google Drive: {e}"))
            return

        drive_ids = [d[1] for d in docs]
        id_to_info = {d[1]: (d[0], d[2]) for d in docs}  # drive_id -> (doc_id, name)

        existing_ids = drive_service.check_files_exist(drive_ids)
        deleted_drive_ids = [fid for fid in drive_ids if fid not in existing_ids]

        if not deleted_drive_ids:
            self.stdout.write(self.style.SUCCESS(
                f"✅ Todos los {len(drive_ids)} archivos siguen existiendo en Drive. Nada que eliminar."
            ))
            return

        self.stdout.write(self.style.WARNING(
            f"\nArchivos eliminados de Drive ({len(deleted_drive_ids)}):"
        ))
        deleted_doc_ids = []
        for fid in deleted_drive_ids:
            doc_id, name = id_to_info[fid]
            deleted_doc_ids.append(doc_id)
            self.stdout.write(f"  - [{doc_id}] {name} (drive_id: {fid})")

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"\n[DRY RUN] Se eliminarían {len(deleted_doc_ids)} registros de la BD. "
                "Ejecuta sin --dry-run para aplicar."
            ))
            return

        count, _ = Document.objects.filter(id__in=deleted_doc_ids).delete()
        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Eliminados {count} documentos huérfanos de la base de datos."
        ))
