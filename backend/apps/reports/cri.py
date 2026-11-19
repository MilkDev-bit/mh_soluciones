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


def project_people(projects_qs):
    """{project_id: [nombres]} de los empleados (CRI) que trabajaron en cada obra.

    Son los alumnos/empleados asignados a las tareas que cuentan para el CRI
    (por "asignado a" o en la lista de asignados). Si una obra no tiene a nadie
    asignado en sus tareas, se usan los miembros del proyecto con ese rol.
    """
    from django.contrib.auth import get_user_model
    from apps.projects.models import ProjectMember

    User = get_user_model()
    student = User.Role.STUDENT
    tasks = (Task.objects.filter(project__in=projects_qs, is_continuous=False)
             .exclude(status=Task.TaskStatus.DRAFT))
    Through = Task.assigned_students.through

    pairs = set(
        Through.objects.filter(task__in=tasks, customuser__role=student)
        .values_list('task__project_id', 'customuser_id')
    )
    pairs |= set(
        tasks.filter(assigned_to__role=student).values_list('project_id', 'assigned_to_id')
    )
    with_people = {pid for pid, _ in pairs}
    pairs |= set(
        ProjectMember.objects.filter(project__in=projects_qs, user__role=student)
        .exclude(project_id__in=with_people)
        .values_list('project_id', 'user_id')
    )

    names = {
        u.id: (u.get_full_name() or u.username).strip()
        for u in User.objects.filter(id__in={uid for _, uid in pairs})
    }
    result = {}
    for pid, uid in pairs:
        result.setdefault(pid, []).append(names[uid])
    return {pid: sorted(v, key=str.lower) for pid, v in result.items()}


def report_rows(projects_qs):
    """Filas del reporte: solo proyectos COMPLETADOS, con ajustes manuales aplicados."""
    completed = projects_qs.filter(status=Project.ProjectStatus.COMPLETED)
    calculated = calculate(completed)
    people = project_people(completed)
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
            'cris': people.get(p.id, []),
            'end_date': p.end_date.isoformat() if p.end_date else None,
            **values,
            'calculado': calc,
            'editado': bool(o),
            'editado_por': (o.updated_by.get_full_name() or o.updated_by.username) if o and o.updated_by else None,
            'editado_en': o.updated_at.isoformat() if o else None,
        })
    return rows
