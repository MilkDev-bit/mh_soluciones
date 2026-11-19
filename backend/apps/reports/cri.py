"""
Calificación final del CRI por proyecto completado.

CRI (%) = entregas terminadas / entregas asignadas × 100

- Asignadas: tareas del proyecto (sin borradores ni tareas continuas).
- Terminadas: tareas con al menos una entrega del alumno, o marcadas como
  completadas. Una entrega pendiente de revisión ya cuenta como terminada.
- Vencidas: tareas que se quedaron sin entregar. Como el proyecto ya está
  completado, ya no se pueden entregar, así que son vencidas aunque no tengan
  fecha límite o la tengan después del cierre. Por eso siempre
  asignadas = terminadas + vencidas.

Los valores corregidos a mano se guardan en ProjectCRIOverride y tienen
prioridad sobre los calculados.
"""
from django.db.models import Count, Exists, OuterRef, Q

from apps.projects.models import Project
from apps.tasks.models import Task, TaskSubmission

from .models import ProjectCRIOverride


def cri_percent(asignadas, terminadas):
    if not asignadas:
        return 0
    return max(0, min(100, round(terminadas * 100 / asignadas)))


def calculate(projects_qs):
    """{project_id: {'asignadas', 'terminadas', 'vencidas', 'cri'}} desde la BD."""
    delivered = Q(has_submission=True) | Q(status=Task.TaskStatus.COMPLETED)
    rows = (
        Task.objects.filter(project__in=projects_qs, is_continuous=False)
        .exclude(status=Task.TaskStatus.DRAFT)
        .annotate(has_submission=Exists(TaskSubmission.objects.filter(task=OuterRef('pk'))))
        .values('project_id')
        .annotate(
            asignadas=Count('id'),
            terminadas=Count('id', filter=delivered),
        )
    )
    result = {}
    for r in rows:
        result[r['project_id']] = {
            'asignadas': r['asignadas'],
            'terminadas': r['terminadas'],
            'vencidas': r['asignadas'] - r['terminadas'],
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
            # Las vencidas siempre son lo que falta para llegar a las asignadas.
            {'asignadas': o.asignadas, 'terminadas': o.terminadas,
             'vencidas': max(0, o.asignadas - o.terminadas), 'cri': o.cri}
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
