"""
Management command to manually trigger the weekly student task assignment.
Usage: python manage.py assign_students_to_tasks
"""
from django.core.management.base import BaseCommand
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        'Asigna automáticamente todos los miembros STUDENT de cada proyecto activo '
        'al campo assigned_students de las tareas abiertas de ese proyecto. '
        'Es la misma lógica que ejecuta Celery Beat cada domingo a medianoche.'
    )

    def handle(self, *args, **options):
        from apps.tasks.tasks import assign_tasks_to_students_weekly

        self.stdout.write(self.style.WARNING(
            '🔄 Ejecutando asignación semanal de tareas a estudiantes...'
        ))

        result = assign_tasks_to_students_weekly()

        self.stdout.write(self.style.SUCCESS(
            f"✅ Proceso completado.\n"
            f"   Proyectos procesados:    {result['projects_processed']}\n"
            f"   Tareas actualizadas:     {result['tasks_updated']}\n"
            f"   Asignaciones nuevas:     {result['new_assignments']}"
        ))
