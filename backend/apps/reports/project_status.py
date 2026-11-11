"""
Estado actual de un proyecto para las gráficas de "Progreso del Proyecto".

Usa el mismo criterio que el reporte semanal de entregables
(apps/reports/entregables.py), pero para un solo proyecto y varias semanas:

- current / previous: cumplimiento de la semana ISO en curso y de la anterior
  ("5 de 7", semáforo y lo que falta).
- trend: % de cumplimiento de las últimas semanas (desde que inició el proyecto).
- punctuality: de los entregables de esas semanas, cuántos se entregaron a
  tiempo, tarde (con prórroga) o no se entregaron.
- safety: índice de frecuencia, actos y condiciones por semana (tabla de GRÁFICAS).
- review: entregas por revisar, devueltas con cambios y calificación promedio.
- timeline: días transcurridos contra la duración planeada y última captura
  de gráficas.
"""
from datetime import date, timedelta

from django.db.models import Avg
from django.utils import timezone

from apps.projects.models import Project
from apps.tasks.models import Task, TaskSubmission

from .entregables import (
    GRAFICAS, STANDARD_NAMES, collect_rows, graficas_safety_by_week, standard_key,
)

TREND_WEEKS = 10


def semaforo(done, total):
    """Mismo código de color del reporte: verde (le falta a lo más 1), amarillo (3+), rojo (0-2)."""
    if total and done >= total - 1:
        return 'green'
    if done >= 3:
        return 'yellow'
    return 'red'


def _iso_range_label(year, week):
    from .entregables import MESES, iso_week_bounds
    lunes, domingo = iso_week_bounds(year, week)
    if lunes.month == domingo.month:
        return f'{lunes.day}–{domingo.day} {MESES[domingo.month - 1][:3].lower()}'
    return f'{lunes.day} {MESES[lunes.month - 1][:3].lower()} – {domingo.day} {MESES[domingo.month - 1][:3].lower()}'


def _week_summary(project, year, week):
    rows = collect_rows(Project.objects.filter(pk=project.pk), year, week, only_in_progress=False)
    if not rows:
        return None
    row = rows[0]
    faltan = [d['entregable'] for d in row.detail if d['estado'] != 'Entregado']
    tardias = [d for d in row.detail if d['estado'] == 'Entregado' and d['motivo'].startswith('Entregada tarde')]
    return {
        'year': year,
        'week': week,
        'label': f'SEM {week}',
        'range': _iso_range_label(year, week),
        'done': row.done,
        'total': row.total,
        'pct': round(row.done / row.total * 100) if row.total else 0,
        'color': semaforo(row.done, row.total),
        'missing': faltan,
        'late': len(tardias),
        'detail': row.detail,
    }


def build_project_status(project, today=None, weeks=TREND_WEEKS):
    today = today or timezone.localdate()
    start = project.start_date or (timezone.localtime(project.created_at).date() if project.created_at else today)

    # Semanas ISO a revisar: las últimas `weeks`, sin pasar del inicio del proyecto.
    week_list = []
    monday = today - timedelta(days=today.weekday())
    for i in range(weeks - 1, -1, -1):
        lunes = monday - timedelta(weeks=i)
        if lunes + timedelta(days=6) < start:
            continue
        y, w, _ = lunes.isocalendar()
        week_list.append((y, w))

    summaries = [s for s in (_week_summary(project, y, w) for y, w in week_list) if s]
    current = summaries[-1] if summaries else None
    previous = summaries[-2] if len(summaries) > 1 else None

    # Puntualidad: semanas ya cerradas (sin la actual, que aún corre).
    cerradas = summaries[:-1] if summaries else []
    a_tiempo = tarde = faltan = 0
    for s in cerradas:
        for d in s['detail']:
            if d['estado'] != 'Entregado':
                faltan += 1
            elif d['motivo'].startswith('Entregada tarde'):
                tarde += 1
            else:
                a_tiempo += 1

    # Seguridad: tabla de GRÁFICAS del proyecto.
    graficas = [t for t in Task.objects.filter(project=project).only('id', 'title', 'description')
                if standard_key(t.title) == GRAFICAS]
    safety_by_week = {}
    for t in graficas:
        for key, vals in graficas_safety_by_week(t.description, project).items():
            safety_by_week.setdefault(key, vals)
    safety = []
    for y, w in week_list:
        vals = safety_by_week.get((y, w))
        safety.append({
            'label': f'SEM {w}',
            'range': _iso_range_label(y, w),
            'actos': vals['actos'] if vals else 0,
            'condiciones': vals['condiciones'] if vals else 0,
            'hh': vals['hh'] if vals else 0,
            'indice': vals['indice'] if vals else None,
        })
    capturadas = sorted(k for k, v in safety_by_week.items()
                        if v['ft'] or v['actos'] or v['condiciones'])
    current_key = monday.isocalendar()[:2]
    capturadas = [k for k in capturadas if k <= current_key]
    ultima = capturadas[-1] if capturadas else None
    semanas_sin_captura = None
    if ultima:
        lunes_ultima = date.fromisocalendar(ultima[0], ultima[1], 1)
        semanas_sin_captura = max(0, (monday - lunes_ultima).days // 7)
    hh_total = sum(v['hh'] for k, v in safety_by_week.items() if k <= current_key)

    # Revisión: versiones vigentes (sin las reemplazadas).
    subs = TaskSubmission.objects.filter(task__project=project).exclude(status=TaskSubmission.SubmissionStatus.SUPERSEDED)
    review = {
        'pending': subs.filter(status__in=TaskSubmission.PENDING_REVIEW_STATUSES).count(),
        'changes_requested': subs.filter(status=TaskSubmission.SubmissionStatus.CHANGES_REQUESTED).count(),
        'approved': subs.filter(status__in=[TaskSubmission.SubmissionStatus.APPROVED,
                                            TaskSubmission.SubmissionStatus.GRADED]).count(),
        'avg_score': None,
        'total_submissions': TaskSubmission.objects.filter(task__project=project).count(),
    }
    avg = subs.filter(score__isnull=False).aggregate(v=Avg('score'))['v']
    if avg is not None:
        review['avg_score'] = round(float(avg), 1)

    # Línea de tiempo.
    end = project.end_date
    hasta = min(today, end) if end else today
    timeline = {
        'start_date': start.isoformat() if start else None,
        'end_date': end.isoformat() if end else None,
        'days_elapsed': max(0, (hasta - start).days) if start else None,
        'days_total': (end - start).days if (end and start and end > start) else None,
        'pct_time': None,
        'last_capture': f'SEM {ultima[1]} · {ultima[0]}' if ultima else None,
        'weeks_without_capture': semanas_sin_captura,
        'hh_total': hh_total,
    }
    if timeline['days_total']:
        timeline['pct_time'] = min(100, round(timeline['days_elapsed'] / timeline['days_total'] * 100))

    strip = lambda s: {k: v for k, v in s.items() if k != 'detail'} if s else None
    return {
        'week_names': list(STANDARD_NAMES.values()),
        'current': strip(current),
        'previous': strip(previous),
        'trend': [{k: s[k] for k in ('label', 'range', 'year', 'week', 'done', 'total', 'pct', 'color')}
                  for s in summaries],
        'punctuality': {'on_time': a_tiempo, 'late': tarde, 'missing': faltan,
                        'weeks': len(cerradas)},
        'safety': safety,
        'review': review,
        'timeline': timeline,
    }
