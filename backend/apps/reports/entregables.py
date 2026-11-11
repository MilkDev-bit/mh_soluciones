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
- Cumplimiento: "X de N", donde N son las tareas estándar semanales que tiene
  el proyecto (Matriz de cumplimiento SH, Pláticas de seguridad, Pirámide SH,
  QR Weekly, Gráficas, Campañas y KPI) y X las que tienen al menos una entrega
  hecha dentro de la semana.
- Proyecto cerrado durante la semana: "Entregado".
- Proyecto que inició durante la semana: comentario "Inicio".

Las fórmulas son las mismas del archivo original, pero compatibles con Excel
(el original usaba REGEXMATCH/SPLIT de Google Sheets); se guardan con su
valor ya calculado para que se vean bien en cualquier visor.
"""
import io
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from django.utils import timezone

from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskSubmission

# Las 7 tareas estándar semanales (mismas que asigna assign_tasks_to_students_weekly).
STANDARD_TASKS = [
    'matriz de cumplimiento sh',
    'platicas de seguridad',
    'piramide sh',
    'qr weekly',
    'graficas',
    'campanas',
    'kpi',
]

MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

FIRST_DATA_ROW = 11  # fila de Excel (1-based) del primer proyecto


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

    # Tareas estándar de cada proyecto. Un proyecto puede tener varias tareas
    # con el mismo nombre (una por semana): se agrupan por nombre y cuenta la
    # entrega hecha en cualquiera de ellas.
    std_tasks = {}       # project_id -> {nombre normalizado: [task ids]}
    task_key = {}        # task_id -> (project_id, nombre normalizado)
    for t in Task.objects.filter(project_id__in=project_ids).only('id', 'title', 'project_id'):
        key = normalize(t.title)
        if key in STANDARD_TASKS:
            std_tasks.setdefault(t.project_id, {}).setdefault(key, []).append(t.id)
            task_key[t.id] = (t.project_id, key)

    # Entregas hechas dentro de la semana: primer día de entrega por (proyecto, tarea).
    delivered = {}
    for sub in (TaskSubmission.objects
                .filter(task_id__in=list(task_key), created_at__gte=week_start, created_at__lt=week_end)
                .values('task_id', 'created_at')):
        local_day = timezone.localtime(sub['created_at']).date()
        k = task_key[sub['task_id']]
        prev = delivered.get(k)
        if prev is None or local_day < prev:
            delivered[k] = local_day

    rows = []
    for p, start, end in candidates:
        tasks = std_tasks.get(p.id, {})
        row = ProjectRow(name=p.name, cri=', '.join(cri_by_project.get(p.id, [])))
        row.total = len(tasks) or len(STANDARD_TASKS)
        days = [delivered[(p.id, key)] for key in tasks if (p.id, key) in delivered]
        row.done = len(days)
        row.delivery_days = [(d - monday).days + 1 for d in days]
        if p.status == Project.ProjectStatus.COMPLETED and end and monday <= end <= sunday:
            row.delivered_project = True
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

    # Impresión: hoja horizontal y una página de ancho (el original no tenía ajuste).
    ws.set_landscape()
    ws.fit_to_pages(1, 0)
    ws_chart.set_landscape()
    ws_chart.fit_to_pages(1, 1)

    ws.activate()
    wb.close()
    return output.getvalue()
