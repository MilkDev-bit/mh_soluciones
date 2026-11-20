"""
Elimina las entregas que se quedaron vacías porque el SUPERADMIN borró su
último archivo antes de que existiera la limpieza automática.

Solo toca entregas que aparecen en el registro de actividad como
ARCHIVO_ELIMINADO y que ya no tienen archivos, enlace ni archivo directo.
Por defecto solo muestra lo que haría; con --apply las elimina.

    python manage.py eliminar_entregas_vaciadas
    python manage.py eliminar_entregas_vaciadas --apply
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.core.models import RegistroActividad
from apps.documents.submission_files import _restore_previous_version, _submission_is_empty
from apps.tasks.models import TaskSubmission


class Command(BaseCommand):
    help = 'Elimina las entregas que quedaron sin archivos tras borrar su último archivo.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Eliminar de verdad (sin esto solo lista).')

    def handle(self, *args, **options):
        ids = {
            m.get('entrega_id')
            for m in RegistroActividad.objects.filter(accion='ARCHIVO_ELIMINADO').values_list('metadata', flat=True)
            if isinstance(m, dict) and m.get('entrega_id')
        }
        subs = (TaskSubmission.objects.filter(pk__in=ids)
                .select_related('task', 'submitted_by').order_by('pk'))
        vacias = [s for s in subs if _submission_is_empty(s)]
        if not vacias:
            self.stdout.write('No hay entregas vacías por eliminar.')
            return
        for s in vacias:
            alumno = s.submitted_by.get_full_name() or s.submitted_by.username
            self.stdout.write(f'- Entrega {s.pk}: {alumno} · "{s.task.title}" · v{s.version} · {s.status}')
        if not options['apply']:
            self.stdout.write(self.style.WARNING(
                f'{len(vacias)} entrega(s) vacía(s). Ejecuta con --apply para eliminarlas.'))
            return
        with transaction.atomic():
            for s in vacias:
                _restore_previous_version(s)
                s.delete()
        self.stdout.write(self.style.SUCCESS(f'{len(vacias)} entrega(s) eliminada(s).'))
