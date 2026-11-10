"""
Datos existentes → nuevo flujo de revisión.

1. LATE pasa a SUBMITTED con is_late=True ("tardía" ahora es un atributo).
2. Las versiones anteriores sin decisión final pasan a SUPERSEDED, para que
   el tablero solo muestre la última versión de cada alumno.
3. Las tareas GRAFICAS se marcan como actividad continua para que la
   reasignación semanal no las muestre como vencidas.
"""
from django.db import migrations
from django.db.models import Max

CONTINUOUS_TITLES = ['graficas', 'gráficas']


def forwards(apps, schema_editor):
    Task = apps.get_model('tasks', 'Task')
    TaskSubmission = apps.get_model('tasks', 'TaskSubmission')

    TaskSubmission.objects.filter(status='LATE').update(status='SUBMITTED', is_late=True)

    latest = (TaskSubmission.objects.values('task_id', 'submitted_by_id')
              .annotate(max_version=Max('version')))
    for row in latest.iterator():
        (TaskSubmission.objects
         .filter(task_id=row['task_id'], submitted_by_id=row['submitted_by_id'],
                 version__lt=row['max_version'])
         .exclude(status__in=['GRADED', 'APPROVED'])
         .update(status='SUPERSEDED'))

    for title in CONTINUOUS_TITLES:
        Task.objects.filter(title__iexact=title).update(is_continuous=True)


def backwards(apps, schema_editor):
    TaskSubmission = apps.get_model('tasks', 'TaskSubmission')
    TaskSubmission.objects.filter(is_late=True, status='SUBMITTED').update(status='LATE')
    TaskSubmission.objects.filter(status='SUPERSEDED').update(status='SUBMITTED')
    TaskSubmission.objects.filter(status='IN_REVIEW').update(status='SUBMITTED')
    TaskSubmission.objects.filter(status='APPROVED').update(status='GRADED')
    TaskSubmission.objects.filter(status='CHANGES_REQUESTED').update(status='GRADED')


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0008_review_flow_deadlines'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
