"""
Estado general de las obras en proceso (Panel de Control de Admin / Superadmin).

Las mismas métricas de "Estado del Proyecto" (apps/reports/project_status.py),
sumadas para todos los proyectos En Progreso y con el criterio del reporte
semanal de entregables:

- current / previous: entregables entregados de todas las obras en la semana
  ISO en curso y en la anterior, cuántas obras están en verde / amarillo / rojo
  y qué entregables faltan más.
- trend: % general de cumplimiento de las últimas semanas ISO.
- punctuality: a tiempo / tarde / sin entregar en las semanas ya cerradas.
- safety: índice de frecuencia general por semana ISO (cada "SEMANA n" de la
  tabla de gráficas de cada obra se ubica en la semana ISO de su mitad).
- review: entregas por revisar, devueltas con cambios y la más antigua.
- attention: obras en amarillo o rojo la semana anterior (la última completa).
"""
from collections import Counter
from datetime import date, timedelta

from django.utils import timezone

from apps.projects.models import Project
from apps.tasks.models import Task, TaskSubmission

from .entregables import (
    ENTREGABLES_POR_SEMANA, GRAFICAS, collect_rows, graficas_safety_by_project_week, standard_key,
)
from .project_status import _iso_range_label, semaforo

TREND_WEEKS = 10


def _color_general(done, total):
    """Semáforo del % general, con los mismos cortes que una obra (6/7 y 3/7)."""
    if not total:
        return 'red'
    return semaforo(round(done / total * ENTREGABLES_POR_SEMANA, 6), ENTREGABLES_POR_SEMANA)


def build_general_status(projects_qs, today=None, weeks=TREND_WEEKS):
    today = today or timezone.localdate()
    projects_qs = projects_qs.filter(status=Project.ProjectStatus.IN_PROGRESS)
    monday = today - timedelta(days=today.weekday())
    week_list = [(monday - timedelta(weeks=i)).isocalendar()[:2] for i in range(weeks - 1, -1, -1)]

    trend, rows_by_week = [], {}
    for y, w in week_list:
        rows = collect_rows(projects_qs, y, w)
        rows_by_week[(y, w)] = rows
        done = sum(r.done for r in rows)
        total = sum(r.total for r in rows)
        colores = Counter(semaforo(r.done, r.total) for r in rows)
        trend.append({
            'label': f'SEM {w}', 'range': _iso_range_label(y, w), 'year': y, 'week': w,
            'done': done, 'total': total, 'projects': len(rows),
            'pct': round(done / total * 100) if total else 0,
            'color': _color_general(done, total),
            'green': colores['green'], 'yellow': colores['yellow'], 'red': colores['red'],
        })

    def week_block(idx):
        if len(trend) < abs(idx):
            return None
        info = dict(trend[idx])
        rows = rows_by_week[(info['year'], info['week'])]
        faltantes = Counter(d['entregable'] for r in rows for d in r.detail if d['estado'] != 'Entregado')
        info['top_missing'] = [{'name': n, 'projects': c} for n, c in faltantes.most_common(3)]
        return info

    current, previous = week_block(-1), week_block(-2)

    # Obras que requieren atención: amarillo o rojo en la última semana completa.
    attention = []
    if previous:
        for r in rows_by_week[(previous['year'], previous['week'])]:
            color = semaforo(r.done, r.total)
            if color == 'green':
                continue
            attention.append({
                'project_id': r.project_id, 'name': r.name, 'cri': r.cri,
                'done': r.done, 'total': r.total, 'color': color,
                'missing': [d['entregable'] for d in r.detail if d['estado'] != 'Entregado'],
            })
        attention.sort(key=lambda a: (a['done'], a['name']))

    # Puntualidad: semanas cerradas (todas menos la actual).
    a_tiempo = tarde = faltan = 0
    for y, w in week_list[:-1]:
        for r in rows_by_week[(y, w)]:
            for d in r.detail:
                if d['estado'] != 'Entregado':
                    faltan += 1
                elif d['motivo'].startswith('Entregada tarde'):
                    tarde += 1
                else:
                    a_tiempo += 1

    # Seguridad: tabla de GRÁFICAS de cada obra activa, sumada por semana ISO.
    proyectos = list(projects_qs)
    by_id = {p.id: p for p in proyectos}
    graficas = [t for t in Task.objects.filter(project_id__in=list(by_id)).only('id', 'title', 'project_id', 'description')
                if standard_key(t.title) == GRAFICAS]
    iso_acc = {}
    hh_total = 0.0
    vistos = set()
    sin_captura = []
    semana_cerrada = week_list[-2] if len(week_list) > 1 else None
    capturadas_cerrada = set()
    for t in graficas:
        if t.project_id in vistos:
            continue
        vistos.add(t.project_id)
        p = by_id[t.project_id]
        start = p.start_date or timezone.localtime(p.created_at).date()
        for n, vals in graficas_safety_by_project_week(t.description, p).items():
            mitad = start + timedelta(weeks=n - 1, days=3)
            if mitad > today:
                continue
            key = mitad.isocalendar()[:2]
            hh_total += vals['hh']
            if semana_cerrada and key == semana_cerrada and (vals['ft'] or vals['actos'] or vals['condiciones']):
                capturadas_cerrada.add(p.id)
            acc = iso_acc.setdefault(key, {'actos': 0.0, 'condiciones': 0.0, 'hh': 0.0})
            acc['actos'] += vals['actos']
            acc['condiciones'] += vals['condiciones']
            acc['hh'] += vals['hh']
    if semana_cerrada:
        for p in proyectos:
            start = p.start_date or timezone.localtime(p.created_at).date()
            if start <= date.fromisocalendar(semana_cerrada[0], semana_cerrada[1], 7) and p.id not in capturadas_cerrada:
                sin_captura.append({'project_id': p.id, 'name': p.name})
        sin_captura.sort(key=lambda x: x['name'])

    safety = []
    for y, w in week_list:
        acc = iso_acc.get((y, w))
        indice = None
        if acc and acc['hh']:
            indice = round((acc['actos'] + acc['condiciones']) / (acc['hh'] / 1000), 2)
        safety.append({
            'label': f'SEM {w}', 'range': _iso_range_label(y, w),
            'actos': acc['actos'] if acc else 0, 'condiciones': acc['condiciones'] if acc else 0,
            'hh': acc['hh'] if acc else 0, 'indice': indice,
        })

    # Revisión de entregas (versiones vigentes) de las obras activas.
    subs = (TaskSubmission.objects.filter(task__project_id__in=list(by_id))
            .exclude(status=TaskSubmission.SubmissionStatus.SUPERSEDED))
    pendientes = subs.filter(status__in=TaskSubmission.PENDING_REVIEW_STATUSES)
    mas_antigua = pendientes.order_by('created_at').values_list('created_at', flat=True).first()
    review = {
        'pending': pendientes.count(),
        'changes_requested': subs.filter(status=TaskSubmission.SubmissionStatus.CHANGES_REQUESTED).count(),
        'oldest_pending_days': (today - timezone.localtime(mas_antigua).date()).days if mas_antigua else None,
        'projects_with_pending': pendientes.values('task__project_id').distinct().count(),
    }

    return {
        'active_projects': len(proyectos),
        'current': current,
        'previous': previous,
        'trend': trend,
        'punctuality': {'on_time': a_tiempo, 'late': tarde, 'missing': faltan, 'weeks': max(0, len(week_list) - 1)},
        'safety': safety,
        'review': review,
        'graficas': {
            'week_label': f'SEM {semana_cerrada[1]}' if semana_cerrada else None,
            'without_capture': sin_captura,
            'hh_total': hh_total,
        },
        'attention': attention,
    }
