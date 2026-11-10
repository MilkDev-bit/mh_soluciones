"""
Entregas anteriores al flujo de revisión por alumno → aprobadas.

En el sistema anterior no se revisaba cada entrega: la tarea completa se
marcaba como completada. Al migrar (0009) todas esas entregas quedaron en
SUBMITTED y aparecían en "Por revisar" aunque nadie las iba a revisar.

Aquí se aprueban las entregas pendientes (SUBMITTED / LATE) creadas ANTES de
que se aplicara la migración 0008 (inicio del nuevo flujo). Las que llegaron
después siguen en "Por revisar". No se envían notificaciones: .update() no
dispara señales.

La reversa regresa a SUBMITTED solo las que marcó esta migración (se
reconocen por el comentario automático).
"""
import datetime

from django.db import migrations
from django.utils import timezone

AUTO_FEEDBACK = 'Aprobada automáticamente: entrega anterior al flujo de revisión por alumno.'


def _review_flow_start(connection):
    """Fecha en que se aplicó 0008_review_flow_deadlines (o None)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT applied FROM django_migrations WHERE app = %s AND name = %s",
            ['tasks', '0008_review_flow_deadlines'],
        )
        row = cursor.fetchone()
    return row[0] if row else None


def forwards(apps, schema_editor):
    TaskSubmission = apps.get_model('tasks', 'TaskSubmission')
    cutoff = _review_flow_start(schema_editor.connection)
    if cutoff is None:
        return
    if timezone.is_naive(cutoff):
        cutoff = timezone.make_aware(cutoff, datetime.timezone.utc)

    TaskSubmission.objects.filter(
        status__in=['SUBMITTED', 'LATE'],
        created_at__lt=cutoff,
    ).update(
        status='APPROVED',
        is_approved=True,
        teacher_feedback=AUTO_FEEDBACK,
        graded_at=cutoff,
    )


def backwards(apps, schema_editor):
    TaskSubmission = apps.get_model('tasks', 'TaskSubmission')
    TaskSubmission.objects.filter(status='APPROVED', teacher_feedback=AUTO_FEEDBACK).update(
        status='SUBMITTED', is_approved=False, teacher_feedback='', graded_at=None,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0009_migrate_review_states'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
