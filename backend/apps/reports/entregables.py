"""
Reporte semanal de entregables (Excel).

Replica el formato del archivo que se llenaba a mano
("Entregables-Semana-02_al_08_de_Noviembre.xlsx"):

- Hoja "Reporte_Estadisticas": bloque de métricas (A1:B7), código de color
  (D1:E4) y la tabla de proyectos desde la fila 10
  (Proyecto | CRI | Cumplimiento esta semana | Comentarios | % Cumplimiento).
- Hoja "Grafico de porcentajes": gráfico de columnas del % de cumplimiento
  por proyecto.

Cómo se calcula cada fila (semana ISO 8601, lunes a domingo, hora local):
- Proyectos: los que estuvieron en obra esa semana, con el mismo criterio que
  "Obras activas por semana": En Progreso con inicio antes del fin de la
  semana, y Completados cuya fecha de fin cae en la semana o después.
- CRI: miembros del proyecto con rol Alumno / Empleado (activos).
- Cumplimiento: "X de 7". Los 7 entregables semanales son Matriz de
  cumplimiento SH, Pláticas de seguridad, Pirámide SH, QR Weekly, Gráficas,
  Campañas y KPI (cada semana se crea otra tarea con el mismo nombre; el
  título se reconoce por palabra clave). X es cuántos entregó esa semana:
    * con archivo: si hay una tarea que vence esa semana, cuenta si tiene
      entrega, aunque se haya subido después con prórroga (si se reabrió para
      todos, cuenta en la semana de su fecha límite original); si ninguna
      vence esa semana, cuenta una entrega subida durante la semana;
    * Gráficas (no lleva archivo): su tabla ya tiene capturada esa semana.
- Proyectos completados: aparecen si trabajaron esa semana; si no, solo como
  "Entregado" cuando su fecha de fin cae en la semana.
- Hoja "Detalle": el motivo de cada entregable, para revisar el reporte.
- Proyecto que inició durante la semana: comentario "Inicio".

Las fórmulas son las mismas del archivo original, pero compatibles con Excel
(el original usaba REGEXMATCH/SPLIT de Google Sheets); se guardan con su
valor ya calculado para que se vean bien en cualquier visor.
"""
import io
import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone

from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskReopenLog, TaskSubmission

# Los 7 entregables semanales: (clave, nombre para mostrar, patrón del título).
# El título se compara sin acentos ni mayúsculas y por palabra clave, porque
# cada proyecto los nombra un poco distinto ("Matriz SH", "PLÁTICAS", ...).
STANDARD = [
    ('matriz', 'Matriz de cumplimiento SH', r'matriz'),
    ('platicas', 'Pláticas de seguridad', r'platica'),
    ('piramide', 'Pirámide SH', r'piramide'),
    ('qr', 'QR Weekly', r'\bqr\b'),
    ('graficas', 'Gráficas', r'grafica'),
    ('campanas', 'Campañas', r'campana'),
    ('kpi', 'KPI', r'\bkpis?\b'),
]
STANDARD_TASKS = [key for key, _, _ in STANDARD]
STANDARD_NAMES = {key: name for key, name, _ in STANDARD}
_STANDARD_RES = [(key, re.compile(pattern)) for key, _, pattern in STANDARD]
ENTREGABLES_POR_SEMANA = len(STANDARD)   # "X de 7"


MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

FIRST_DATA_ROW = 11  # fila de Excel (1-based) del primer proyecto

GRAFICAS = 'graficas'
GRAFICAS_RE = re.compile(r'<!--\s*GRAFICAS_DATA:(.*?)\s*-->', re.S)
ISO_WEEK_RE = re.compile(r'(\d{4})-?W(\d{1,2})', re.I)


def _deadline_day(task):
    """Día (hora local) de la fecha límite de la tarea, o None."""
    if task.close_date:
        return timezone.localtime(task.close_date).date()
    return task.due_date


def _original_deadline_day(task):
    """
    Fecha límite ORIGINAL de una tarea reabierta para todos. Al reabrir se
    sobrescriben due_date y close_date con la prórroga, así que se reconstruye
    igual que al duplicar la tarea semanal: el domingo siguiente a su apertura
    (open_date, o su creación), a las 14:00.
    """
    base = task.open_date or task.created_at
    if not base:
        return _deadline_day(task)
    base = timezone.localtime(base)
    domingo = base.date() + timedelta(days=(6 - base.weekday()) % 7)
    if domingo == base.date() and base.hour >= 14:
        domingo += timedelta(days=7)
    return domingo


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def graficas_week_row(description, project, year, week):
    """
    Fila de la tabla de GRÁFICAS que corresponde a la semana ISO (year, week).
    Las filas guardan "SEMANA n" relativa al inicio del proyecto (o "2026-W46");
    se convierten igual que en las gráficas de Reportes: inicio + (n-1) semanas.
    Devuelve {'semana': texto, 'captured': bool} o None si no hay fila. Una fila
    está capturada si tiene FT, actos, condiciones, incidencias o accidentes > 0.
    """
    match = GRAFICAS_RE.search(description or '')
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except (ValueError, TypeError):
        return None
    if isinstance(data, list):
        rows = data
    elif isinstance(data, dict):
        rows = (data.get('table1') or []) + (data.get('table2') or [])
    else:
        return None

    base = project.start_date or (timezone.localtime(project.created_at).date() if project.created_at else None)
    found = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        texto = str(row.get('semana') or '')
        iso = ISO_WEEK_RE.search(texto)
        if iso:
            row_year, row_week = int(iso.group(1)), int(iso.group(2))
        else:
            n = re.search(r'\d+', texto)
            if not n or not base:
                continue
            row_year, row_week, _ = (base + timedelta(weeks=int(n.group()) - 1)).isocalendar()
        if (row_year, row_week) != (year, week):
            continue
        campos = ('ft', 'actos', 'condiciones', 'incidencias_campo', 'accidentes_incapacitantes')
        captured = any(_num(row.get(c)) > 0 for c in campos)
        if captured:
            return {'semana': texto, 'captured': True}
        found = found or {'semana': texto, 'captured': False}
    return found


def graficas_week_captured(description, project, year, week):
    """¿La tabla de GRÁFICAS tiene capturada la semana ISO (year, week)?"""
    fila = graficas_week_row(description, project, year, week)
    return bool(fila and fila['captured'])



def standard_key(title):
    """Clave del entregable estándar al que corresponde el título, o None."""
    text = normalize(title)
    for key, regex in _STANDARD_RES:
        if regex.search(text):
            return key
    return None


def normalize(text):
    """minúsculas, sin acentos y sin espacios extra: 'Pláticas  de Seguridad' -> 'platicas de seguridad'."""
    text = unicodedata.normalize('NFKD', text or '')
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return ' '.join(text.lower().split())


def iso_week_bounds(year, week):
    """(lunes, domingo) de la semana ISO como objetos date."""
    monday = date.fromisocalendar(year, week, 1)
    return monday, monday + timedelta(days=6)


def week_filename(year, week):
    """'Entregables-Semana-02_al_08_de_Noviembre.xlsx' (mismo nombre que el original)."""
    monday, sunday = iso_week_bounds(year, week)
    if monday.month == sunday.month:
        rango = f'{monday.day:02d}_al_{sunday.day:02d}_de_{MESES[sunday.month - 1]}'
    else:
        rango = (f'{monday.day:02d}_de_{MESES[monday.month - 1]}_al_'
                 f'{sunday.day:02d}_de_{MESES[sunday.month - 1]}')
    return f'Entregables-Semana-{rango}.xlsx'


@dataclass
class ProjectRow:
    name: str
    cri: str
    done: int = 0
    total: int = 0
    delivered_project: bool = False   # proyecto cerrado en la semana -> "Entregado"
    comment: str = ''
    delivery_days: list = field(default_factory=list)
    detail: list = field(default_factory=list)   # filas de la hoja "Detalle"

    @property
    def cumplimiento(self):
        return 'Entregado' if self.delivered_project else f'{self.done} de {self.total}'

    @property
    def porcentaje(self):
        # Igual que el original: IFERROR(...) -> 0 cuando no es "X de N".
        if self.delivered_project or not self.total:
            return 0
        return self.done / self.total


def _project_dates(project):
    start = project.start_date or (timezone.localtime(project.created_at).date() if project.created_at else None)
    end = project.end_date
    if project.status == Project.ProjectStatus.COMPLETED and not end and project.updated_at:
        end = timezone.localtime(project.updated_at).date()
    return start, end


def collect_rows(projects_qs, year, week):
    monday, sunday = iso_week_bounds(year, week)
    tz = timezone.get_current_timezone()
    week_start = timezone.make_aware(datetime.combine(monday, time.min), tz)
    week_end = timezone.make_aware(datetime.combine(sunday + timedelta(days=1), time.min), tz)

    # Proyectos en obra durante la semana (mismo criterio que "Obras activas").
    # Los completados se revisan más abajo: solo entran si trabajaron esa semana.
    candidates = []
    for p in projects_qs.filter(status__in=[Project.ProjectStatus.IN_PROGRESS, Project.ProjectStatus.COMPLETED]):
        start, end = _project_dates(p)
        if not start or start > sunday:
            continue
        if p.status == Project.ProjectStatus.COMPLETED and (not end or end < monday):
            continue
        candidates.append((p, start, end))
    candidates.sort(key=lambda c: (c[1], c[0].id))
    project_ids = [p.id for p, _, _ in candidates]

    # CRI: miembros con rol Alumno / Empleado.
    cri_by_project = {}
    members = (ProjectMember.objects
               .filter(project_id__in=project_ids, user__role='STUDENT', user__is_active=True)
               .select_related('user')
               .order_by('joined_at'))
    for m in members:
        nombre = m.user.get_full_name().strip() or m.user.username
        cri_by_project.setdefault(m.project_id, []).append(nombre)

    # Tareas de los entregables estándar. Cada semana se crea otra tarea con
    # el mismo nombre; cuentan las que ya existían al terminar la semana o las
    # que vencen en ella (aunque se hayan creado después). GRÁFICAS es una sola
    # tarea permanente con todas las semanas: cuenta siempre.
    #
    # La semana de cada tarea es la de su fecha límite ORIGINAL: si se reabrió
    # para todos (prórroga general), su fecha límite cambió, pero sigue siendo
    # la tarea de su semana y su entrega tardía cuenta en esa semana. Las
    # prórrogas por alumno no cambian la fecha de la tarea.
    reopened = set(TaskReopenLog.objects
                   .filter(task__project_id__in=project_ids)
                   .annotate(n_alumnos=Count('specific_students'))
                   .filter(n_alumnos=0)
                   .values_list('task_id', flat=True))

    def week_day(task):
        return _original_deadline_day(task) if task.id in reopened else _deadline_day(task)

    std_tasks = {}       # project_id -> {clave: [Task]}
    for t in (Task.objects
              .filter(project_id__in=project_ids)
              .only('id', 'title', 'project_id', 'due_date', 'close_date', 'open_date',
                    'is_continuous', 'created_at')):
        key = standard_key(t.title)
        if not key:
            continue
        dia = week_day(t)
        if key == GRAFICAS or t.created_at < week_end or (dia and monday <= dia <= sunday):
            std_tasks.setdefault(t.project_id, {}).setdefault(key, []).append(t)

    file_task_ids = [t.id for per in std_tasks.values() for k, ts in per.items() if k != GRAFICAS for t in ts]
    due_in_week = set()
    for per in std_tasks.values():
        for key, ts in per.items():
            if key == GRAFICAS:
                continue
            for t in ts:
                dia = week_day(t)
                if dia and monday <= dia <= sunday:
                    due_in_week.add(t.id)

    # Entregas de esas tareas: todas las de las tareas de la semana y las
    # subidas durante la semana en cualquier otra.
    subs_by_task = {}
    for sub in (TaskSubmission.objects
                .filter(task_id__in=file_task_ids)
                .filter(Q(task_id__in=list(due_in_week)) | Q(created_at__gte=week_start, created_at__lt=week_end))
                .order_by('created_at')
                .values('task_id', 'created_at')):
        subs_by_task.setdefault(sub['task_id'], []).append(timezone.localtime(sub['created_at']).date())

    graficas_ids = [t.id for per in std_tasks.values() for t in per.get(GRAFICAS, [])]
    graficas_desc = dict(Task.objects.filter(id__in=graficas_ids).values_list('id', 'description'))

    fmt_day = lambda d: d.strftime('%d/%m/%Y') if d else ''
    rows = []
    for p, start, end in candidates:
        tasks = std_tasks.get(p.id, {})
        row = ProjectRow(name=p.name, cri=', '.join(cri_by_project.get(p.id, [])))
        row.total = ENTREGABLES_POR_SEMANA
        activity = False

        for key, nombre, _ in STANDARD:
            instancias = tasks.get(key, [])
            entregado, motivo, tarea_txt, entrega = False, '', '', None
            if not instancias:
                motivo = 'El proyecto no tiene esta tarea'
            elif key == GRAFICAS:
                tarea_txt = ', '.join(t.title for t in instancias)
                fila = None
                for t in instancias:
                    fila = graficas_week_row(graficas_desc.get(t.id), p, year, week)
                    if fila:
                        break
                if fila and fila['captured']:
                    entregado, motivo = True, f'Tabla de gráficas capturada ({fila["semana"]})'
                elif fila:
                    motivo = f'La fila {fila["semana"]} está vacía (en ceros)'
                else:
                    motivo = 'La tabla de gráficas no tiene la fila de esta semana'
            else:
                de_la_semana = [t for t in instancias if t.id in due_in_week]
                if de_la_semana:
                    # La tarea de esta semana: cuenta si tiene entrega (aunque sea tarde).
                    activity = True
                    tarea_txt = ', '.join(
                        f'{t.title} (vence {fmt_day(week_day(t))}'
                        + (f', reabierta hasta {fmt_day(_deadline_day(t))})' if t.id in reopened else ')')
                        for t in de_la_semana)
                    fechas = sorted(d for t in de_la_semana for d in subs_by_task.get(t.id, []))
                    if fechas:
                        entregado, entrega = True, fechas[0]
                        motivo = 'Entregada' if fechas[0] <= sunday else f'Entregada tarde ({fmt_day(fechas[0])})'
                    else:
                        motivo = 'Sin entrega'
                else:
                    # Sin tarea con fecha límite en esta semana: cuenta una
                    # entrega subida durante la semana en cualquiera de ellas.
                    fechas = sorted(d for t in instancias for d in subs_by_task.get(t.id, [])
                                    if monday <= d <= sunday)
                    if fechas:
                        entregado, entrega = True, fechas[0]
                        tarea_txt = ', '.join(t.title for t in instancias if any(
                            monday <= d <= sunday for d in subs_by_task.get(t.id, [])))
                        motivo = 'Entrega subida en la semana (ninguna tarea vence esta semana)'
                    else:
                        motivo = 'Ninguna tarea vence esta semana y no hubo entregas'
            if entregado:
                row.done += 1
                activity = True
                if entrega and monday <= entrega <= sunday:
                    row.delivery_days.append((entrega - monday).days + 1)
            row.detail.append({
                'entregable': nombre, 'estado': 'Entregado' if entregado else 'Falta',
                'motivo': motivo, 'tareas': tarea_txt, 'entrega': fmt_day(entrega),
            })

        if p.status == Project.ProjectStatus.COMPLETED and not activity:
            # Proyecto ya cerrado: "Entregado" si cerró esa semana con fecha de
            # fin capturada; si no trabajó esa semana, no aparece.
            if p.end_date and monday <= p.end_date <= sunday:
                row.delivered_project = True
            else:
                continue
        if monday <= start <= sunday:
            row.comment = 'Inicio'
        rows.append(row)
    return rows


def average_delivery_day(rows):
    """
    "Tiempo Promedio Resolucion (Dias)": en promedio, cuántos días después del
    inicio de la semana (lunes = 1 ... domingo = 7) se hicieron las entregas.
    """
    days = [d for r in rows for d in r.delivery_days]
    return round(sum(days) / len(days), 1) if days else 0


def build_workbook(rows, year, week):
    import xlsxwriter

    output = io.BytesIO()
    wb = xlsxwriter.Workbook(output, {'in_memory': True})
    ws = wb.add_worksheet('Reporte_Estadisticas')
    ws_chart = wb.add_worksheet('Grafico de porcentajes')
    ws_detail = wb.add_worksheet('Detalle')

    BLUE, OUTER, INNER = '#435E91', '#74777E', '#DDDDDD'
    BAND = '#F6F8F9'

    # Anchos de columna del original.
    for col, width in zip('ABCDEF', (34.63, 32.75, 31.5, 80.5, 16.88, 11.5)):
        ws.set_column(f'{col}:{col}', width)

    def fmt(**kw):
        base = {'font_name': 'Roboto', 'font_size': 10, 'valign': 'vcenter'}
        base.update(kw)
        return wb.add_format(base)

    header = dict(font_name='Montserrat', font_size=11, bold=True, font_color='#FFFFFF',
                  bg_color=BLUE, align='center', valign='vcenter', border=1)

    # ---- Bloque de métricas (A1:B7): borde exterior gris oscuro, interior claro.
    ws.write('A1', 'Metrica', wb.add_format({**header, 'left_color': OUTER, 'top_color': OUTER,
                                               'right_color': INNER, 'bottom_color': INNER}))
    ws.write('B1', 'Valor', wb.add_format({**header, 'right_color': OUTER, 'top_color': OUTER,
                                             'left_color': INNER, 'bottom_color': INNER}))

    def metric_formats(last=False, num_format=None):
        bottom = OUTER if last else INNER
        a = fmt(align='left', border=1, left_color=OUTER, right_color=INNER, top_color=INNER, bottom_color=bottom)
        extra = {'num_format': num_format} if num_format else {}
        b = fmt(align='center', border=1, left_color=INNER, right_color=OUTER, top_color=INNER,
                bottom_color=bottom, **extra)
        return a, b

    n = len(rows)
    last_row = FIRST_DATA_ROW + max(n, 1) - 1
    rng = f'C{FIRST_DATA_ROW}:C{last_row}'
    total = sum(r.total for r in rows if not r.delivered_project)
    done = sum(r.done for r in rows if not r.delivered_project)

    metrics = [
        ('Total de Tareas', 'array', f'=SUM(IFERROR(VALUE(MID({rng},FIND(" de ",{rng})+4,9)),0))', total, None),
        ('Tareas Completadas', 'array', f'=SUM(IFERROR(VALUE(LEFT({rng},FIND(" de ",{rng})-1)),0))', done, None),
        ('Tareas En Progreso', 'formula', '=B2', total, None),
        ('Tareas Vencidas', 'formula', '=B2-B3', total - done, None),
        ('Tiempo Promedio Resolucion (Dias)', 'value', None, average_delivery_day(rows), None),
        ('Porcentaje General Entregas', 'formula', '=IFERROR(B3/B2,0)', (done / total) if total else 0, '0.00%'),
    ]
    for i, (label, kind, formula, value, num_format) in enumerate(metrics):
        r = i + 1  # fila 0-based (A2..A7)
        fa, fb = metric_formats(last=(i == len(metrics) - 1), num_format=num_format)
        ws.write(r, 0, label, fa)
        if kind == 'array':
            ws.write_array_formula(r, 1, r, 1, formula, fb, value)
        elif kind == 'formula':
            ws.write_formula(r, 1, formula, fb, value)
        else:
            ws.write_number(r, 1, value, fb)

    # ---- Código de color (D1:E4, celdas combinadas).
    ws.merge_range('D1:E1', 'Codigo color', wb.add_format({**header, 'border_color': OUTER}))
    legend = [('entre 1 y 2', '#FF0000', '#FFFFFF'), ('Entre 3 y 4', '#FFFF00', '#000000'),
              ('Entre 5 y 6', '#00FF00', '#000000')]
    for i, (text, bg, color) in enumerate(legend):
        ws.merge_range(i + 1, 3, i + 1, 4, text,
                       fmt(align='center', bg_color=bg, font_color=color, border=1, border_color='#000000'))

    # ---- Tabla de proyectos (encabezado en la fila 10).
    head_row = FIRST_DATA_ROW - 2  # 0-based -> fila 10 de Excel
    for col, title in enumerate(['Proyecto', 'CRI', 'Cumplimiento esta semana', 'Comentarios', '% Cumplimiento']):
        ws.write(head_row, col, title, wb.add_format({**header, 'border_color': OUTER}))

    cell = {'border': 1, 'border_color': '#000000'}
    formats = {}
    for band, bg in (('w', '#FFFFFF'), ('g', BAND)):
        formats[band] = {
            'left': fmt(align='left', bg_color=bg, **cell),
            'center': fmt(align='center', bg_color=bg, **cell),
            'pct': fmt(align='center', bg_color=bg, num_format='0.00%', **cell),
        }

    for i, row in enumerate(rows):
        r = FIRST_DATA_ROW - 1 + i
        f = formats['w' if i % 2 == 0 else 'g']
        excel_row = r + 1
        ws.write_string(r, 0, row.name, f['left'])
        ws.write_string(r, 1, row.cri, f['left'])
        ws.write_string(r, 2, row.cumplimiento, f['center'])
        ws.write_string(r, 3, row.comment, f['center'])
        c = f'C{excel_row}'
        ws.write_formula(
            r, 4,
            f'=IFERROR(VALUE(LEFT({c},FIND(" de ",{c})-1))/VALUE(MID({c},FIND(" de ",{c})+4,9)),0)',
            f['pct'], row.porcentaje,
        )

    # ---- Formato condicional del cumplimiento (mismos colores que el original).
    if rows:
        data_rng = f'C{FIRST_DATA_ROW}:C{last_row}'
        c = f'$C{FIRST_DATA_ROW}'
        hechos = f'VALUE(LEFT({c},FIND(" de ",{c})-1))'
        de = f'VALUE(MID({c},FIND(" de ",{c})+4,9))'
        green = wb.add_format({'bg_color': '#00FF00', 'font_color': '#000000'})
        yellow = wb.add_format({'bg_color': '#FFFF00', 'font_color': '#000000'})
        red = wb.add_format({'bg_color': '#FF0000', 'font_color': '#FFFFFF'})
        # Verde: 6-7 de 7 / 5-6 de 6 (le falta a lo más una). Amarillo: 3 o más. Rojo: 0-2.
        ws.conditional_format(data_rng, {'type': 'formula', 'criteria': f'=IFERROR({hechos}>={de}-1,FALSE)',
                                         'format': green, 'stop_if_true': True})
        ws.conditional_format(data_rng, {'type': 'formula', 'criteria': f'=IFERROR({hechos}>=3,FALSE)',
                                         'format': yellow, 'stop_if_true': True})
        ws.conditional_format(data_rng, {'type': 'formula', 'criteria': f'=IFERROR({hechos}<=2,FALSE)',
                                         'format': red})
        # Comentarios con texto: resaltados como en el original.
        ws.conditional_format(f'D{FIRST_DATA_ROW}:D{last_row}', {
            'type': 'no_blanks',
            'format': wb.add_format({'bold': True, 'font_color': '#1C4587', 'bg_color': '#F3F3F3'}),
        })

    # ---- Gráfico de porcentajes (hoja aparte, columnas, leyenda a la derecha).
    chart = wb.add_chart({'type': 'column'})
    chart.add_series({
        'name': ['Reporte_Estadisticas', head_row, 4],
        'categories': ['Reporte_Estadisticas', FIRST_DATA_ROW - 1, 0, last_row - 1, 0],
        'values': ['Reporte_Estadisticas', FIRST_DATA_ROW - 1, 4, last_row - 1, 4],
        'fill': {'color': BLUE},
        'border': {'none': True},
    })
    chart.set_x_axis({'line': {'none': True}, 'major_tick_mark': 'none',
                      'num_font': {'color': '#000000', 'rotation': -45 if n > 25 else 0}})
    chart.set_y_axis({'line': {'none': True}, 'major_tick_mark': 'none', 'num_format': '0%', 'min': 0, 'max': 1,
                      'major_gridlines': {'visible': True, 'line': {'color': '#B7B7B7'}},
                      'num_font': {'color': '#000000'}})
    chart.set_title({'none': True})
    chart.set_legend({'position': 'right', 'font': {'color': '#1A1A1A'}})
    # Mismo tamaño que en el original (≈ 24 x 18.5 pulgadas), anclado en A3.
    chart.set_size({'width': 2462, 'height': 1867})
    ws_chart.insert_chart('A3', chart, {'x_offset': 43, 'y_offset': 6})

    # ---- Hoja "Detalle": por qué cada entregable cuenta o no (para revisar el reporte).
    for col, width in zip('ABCDEF', (34, 26, 12, 52, 60, 16)):
        ws_detail.set_column(f'{col}:{col}', width)
    detail_head = wb.add_format({**header, 'border_color': OUTER})
    for col, title in enumerate(['Proyecto', 'Entregable', 'Estado', 'Motivo', 'Tarea(s) revisadas', 'Fecha de entrega']):
        ws_detail.write(0, col, title, detail_head)
    d_cell = fmt(align='left', border=1, border_color='#000000')
    d_ok = fmt(align='center', border=1, border_color='#000000', bg_color='#00FF00')
    d_falta = fmt(align='center', border=1, border_color='#000000', bg_color='#FF0000', font_color='#FFFFFF')
    r = 1
    for row in rows:
        for item in row.detail:
            ws_detail.write_string(r, 0, row.name, d_cell)
            ws_detail.write_string(r, 1, item['entregable'], d_cell)
            ws_detail.write_string(r, 2, item['estado'], d_ok if item['estado'] == 'Entregado' else d_falta)
            ws_detail.write_string(r, 3, item['motivo'], d_cell)
            ws_detail.write_string(r, 4, item['tareas'], d_cell)
            ws_detail.write_string(r, 5, item['entrega'], d_cell)
            r += 1
    if r > 1:
        ws_detail.autofilter(0, 0, r - 1, 5)
    ws_detail.freeze_panes(1, 0)

    # Impresión: hoja horizontal y una página de ancho (el original no tenía ajuste).
    ws.set_landscape()
    ws.fit_to_pages(1, 0)
    ws_chart.set_landscape()
    ws_chart.fit_to_pages(1, 1)

    ws.activate()
    wb.close()
    return output.getvalue()
