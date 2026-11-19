"""
Calificación final del CRI por proyecto completado.

CRI (%) = entregas terminadas / entregas asignadas × 100

- Asignadas: tareas del proyecto (sin borradores ni tareas continuas).
- Terminadas: tareas con al menos una entrega del alumno, o marcadas como
  completadas. Una entrega pendiente de revisión ya cuenta como terminada.
- Vencidas: tareas sin entrega cuya fecha límite (o de cierre) ya pasó.

Los valores corregidos a mano se guardan en ProjectCRIOverride y tienen
prioridad sobre los calculados.
"""
from django.db.models import Count, Exists, OuterRef, Q
from django.utils import timezone

from apps.projects.models import Project
from apps.tasks.models import Task, TaskSubmission

from .models import ProjectCRIOverride


def cri_percent(asignadas, terminadas):
    if not asignadas:
        return 0
    return max(0, min(100, round(terminadas * 100 / asignadas)))


def calculate(projects_qs):
    """{project_id: {'asignadas', 'terminadas', 'vencidas', 'cri'}} desde la BD."""
    today = timezone.localdate()
    now = timezone.now()
    delivered = Q(has_submission=True) | Q(status=Task.TaskStatus.COMPLETED)
    rows = (
        Task.objects.filter(project__in=projects_qs, is_continuous=False)
        .exclude(status=Task.TaskStatus.DRAFT)
        .annotate(has_submission=Exists(TaskSubmission.objects.filter(task=OuterRef('pk'))))
        .values('project_id')
        .annotate(
            asignadas=Count('id'),
            terminadas=Count('id', filter=delivered),
            vencidas=Count('id', filter=~delivered & (Q(due_date__lt=today) | Q(close_date__lt=now))),
        )
    )
    result = {}
    for r in rows:
        result[r['project_id']] = {
            'asignadas': r['asignadas'],
            'terminadas': r['terminadas'],
            'vencidas': r['vencidas'],
            'cri': cri_percent(r['asignadas'], r['terminadas']),
        }
    return result


def report_rows(projects_qs):
    """Filas del reporte: solo proyectos COMPLETADOS, con ajustes manuales aplicados."""
    completed = projects_qs.filter(status=Project.ProjectStatus.COMPLETED)
    calculated = calculate(completed)
    overrides = {
        o.project_id: o
        for o in ProjectCRIOverride.objects.filter(project__in=completed).select_related('updated_by')
    }
    empty = {'asignadas': 0, 'terminadas': 0, 'vencidas': 0, 'cri': 0}
    rows = []
    for p in completed.order_by('-end_date', 'name'):
        calc = calculated.get(p.id, empty)
        o = overrides.get(p.id)
        values = (
            {'asignadas': o.asignadas, 'terminadas': o.terminadas, 'vencidas': o.vencidas, 'cri': o.cri}
            if o else dict(calc)
        )
        rows.append({
            'project_id': p.id,
            'name': p.name,
            'end_date': p.end_date.isoformat() if p.end_date else None,
            **values,
            'calculado': calc,
            'editado': bool(o),
            'editado_por': (o.updated_by.get_full_name() or o.updated_by.username) if o and o.updated_by else None,
            'editado_en': o.updated_at.isoformat() if o else None,
        })
    return rows
