"""Reporte semanal de entregables en Excel (semana ISO 8601)."""
import io
import json
import re
import zipfile
from datetime import date, datetime
from xml.etree import ElementTree as ET
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.projects.models import Project, ProjectMember
from apps.reports.entregables import build_workbook, collect_rows, week_filename
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()

STD = ['Matriz de cumplimiento SH', 'Pláticas de seguridad', 'PIRAMIDE SH', 'QR WEEKLY',
       'GRAFICAS', 'Campañas', 'KPI']
FILES = [t for t in STD if t != 'GRAFICAS']   # entregables con archivo


NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def read_xlsx(content):
    """Lee el .xlsx sin dependencias: hojas, gráficos y {celda: (valor, fórmula)} de la hoja 1."""
    z = zipfile.ZipFile(io.BytesIO(content))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = [s.get('name') for s in wb.find('m:sheets', NS)]
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            strings.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    cells = {}
    for c in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).iter('{%s}c' % NS['m']):
        v, f = c.find('m:v', NS), c.find('m:f', NS)
        value = v.text if v is not None else None
        if value is not None and c.get('t') == 's':
            value = strings[int(value)]
        elif value is not None and c.get('t') not in ('str', 'inlineStr'):
            value = float(value)
        cells[c.get('r')] = (value, f.text if f is not None else None)
    charts = [n for n in z.namelist() if re.match(r'xl/charts/chart\d+\.xml', n)]
    return sheets, charts, cells


def local(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class EntregablesReportTests(TestCase):
    # Semana ISO 45 de 2026: lunes 2 – domingo 8 de noviembre.
    YEAR, WEEK = 2026, 45

    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.cri = User.objects.create_user(username='cri', email='c@x.com', password='x', role='STUDENT',
                                            first_name='Jose Juan', last_name='Diaz')

    def project(self, name, start, status='IN_PROGRESS', end=None, tasks=STD):
        p = Project.objects.create(name=name, description='d', status=status, created_by=self.admin,
                                   start_date=start, end_date=end)
        ProjectMember.objects.create(project=p, user=self.cri, role='MEMBER')
        created = {t: Task.objects.create(title=t, project=p, created_by=self.admin) for t in tasks}
        # Las tareas ya existían en la semana del reporte.
        Task.objects.filter(project=p).update(created_at=local(2026, 10, 1, 9, 0))
        return p, created

    def deliver(self, task, when):
        s = TaskSubmission.objects.create(task=task, submitted_by=self.cri, notes='ok')
        TaskSubmission.objects.filter(pk=s.pk).update(created_at=when)

    def graficas(self, task, rows):
        task.description = 'Tabla <!-- GRAFICAS_DATA:%s -->' % json.dumps({'table1': rows, 'table2': []})
        task.save(update_fields=['description'])

    def test_rows(self):
        _, t1 = self.project('Axioma', date(2026, 9, 1))
        for title in FILES[:5]:
            self.deliver(t1[title], local(2026, 11, 7, 18, 0))          # sábado: 5 con archivo
        self.deliver(t1['KPI'], local(2026, 11, 9, 0, 30))              # lunes sig.: no cuenta
        # Inicio 1/sep (semana ISO 36): "SEMANA 10" es la semana 45.
        self.graficas(t1['GRAFICAS'], [{'semana': 'SEMANA 10', 'actos': 0, 'condiciones': 1, 'ft': 12}])
        _, t2 = self.project('Mexicali', date(2026, 11, 4))              # inició esa semana
        self.project('Guram', date(2026, 8, 1), status='COMPLETED', end=date(2026, 11, 5))
        self.project('Viejo', date(2026, 1, 1), status='COMPLETED', end=date(2026, 10, 30))  # ya cerrado
        self.project('Plan', date(2026, 10, 1), status='PLANNING')       # no está en obra
        self.project('Seis', date(2026, 10, 1), tasks=STD[:6])           # solo 6 tareas estándar

        rows = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)
        by_name = {r.name: r for r in rows}
        self.assertEqual([r.name for r in rows], ['Guram', 'Axioma', 'Seis', 'Mexicali'])
        self.assertEqual(by_name['Axioma'].cumplimiento, '6 de 7')
        self.assertEqual(by_name['Axioma'].cri, 'Jose Juan Diaz')
        self.assertEqual(by_name['Mexicali'].cumplimiento, '0 de 7')
        self.assertEqual(by_name['Mexicali'].comment, 'Inicio')
        self.assertEqual(by_name['Guram'].cumplimiento, 'Entregado')
        self.assertEqual(by_name['Seis'].cumplimiento, '0 de 7')       # siempre de 7

    def test_graficas_counts_only_when_week_captured(self):
        _, t = self.project('Axioma', date(2026, 9, 1))
        g = t['GRAFICAS']
        self.graficas(g, [{'semana': 'SEMANA 9', 'ft': 10}, {'semana': 'SEMANA 10', 'ft': 0, 'actos': 0}])
        self.assertEqual(collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0].done, 0)
        self.graficas(g, [{'semana': '2026-W45', 'ft': 8}])                # formato ISO también vale
        self.assertEqual(collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0].done, 1)
        # Una entrega de archivo en GRÁFICAS no cuenta: solo la tabla.
        self.graficas(g, [])
        self.deliver(g, local(2026, 11, 4, 9, 0))
        self.assertEqual(collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0].done, 0)

    def test_task_of_the_week_delivered_late_counts(self):
        p, t = self.project('Axioma', date(2026, 9, 1))
        Task.objects.filter(pk=t['KPI'].pk).update(due_date=date(2026, 11, 6))        # tarea de la semana 45
        self.deliver(t['KPI'], local(2026, 11, 10, 9, 0))                              # subida tarde (semana 46)
        Task.objects.filter(pk=t['QR WEEKLY'].pk).update(due_date=date(2026, 10, 30))  # tarea de la semana 44
        self.deliver(t['QR WEEKLY'], local(2026, 11, 10, 9, 0))                        # no es de la 45
        rows = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)
        self.assertEqual(rows[0].cumplimiento, '1 de 7')
        self.assertEqual(rows[0].delivery_days, [])     # no se entregó dentro de la semana

    def test_tasks_created_after_the_week_dont_count(self):
        p, _ = self.project('Axioma', date(2026, 9, 1), tasks=FILES[:3])
        nueva = Task.objects.create(title='KPI', project=p, created_by=self.admin)
        Task.objects.filter(pk=nueva.pk).update(created_at=local(2026, 11, 12, 9, 0))
        row = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0]
        kpi = next(d for d in row.detail if d['entregable'] == 'KPI')
        self.assertEqual(kpi['motivo'], 'El proyecto no tiene esta tarea')

    def test_titles_matched_by_keyword(self):
        self.project('Axioma', date(2026, 9, 1), tasks=['MATRIZ SH', 'Plática de Seguridad', 'Pirámide', 'QR',
                                                        'Gráficas', 'Campaña de seguridad', 'KPIs'])
        row = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0]
        self.assertFalse([d for d in row.detail if d['motivo'] == 'El proyecto no tiene esta tarea'])

    def test_week_task_wins_over_other_weeks_submissions(self):
        # La Matriz de esta semana no se entregó; subir la de la semana pasada
        # durante esta semana no la cubre.
        p, t = self.project('Axioma', date(2026, 9, 1))
        vieja = t['Matriz de cumplimiento SH']
        Task.objects.filter(pk=vieja.pk).update(due_date=date(2026, 10, 30))
        nueva = Task.objects.create(title='Matriz de cumplimiento SH', project=p, created_by=self.admin,
                                    due_date=date(2026, 11, 6))
        Task.objects.filter(pk=nueva.pk).update(created_at=local(2026, 11, 2, 8, 0))
        self.deliver(vieja, local(2026, 11, 3, 9, 0))
        row = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0]
        self.assertEqual(row.done, 0)

    def test_completed_projects(self):
        # Cerrado esa semana pero con entregas: se cuentan sus entregables.
        _, t = self.project('Paseo', date(2026, 9, 1), status='COMPLETED', end=date(2026, 11, 6))
        self.deliver(t['KPI'], local(2026, 11, 4, 9, 0))
        # Cerrado sin fecha de fin ni entregas: no aparece.
        self.project('Constitucion', date(2026, 8, 1), status='COMPLETED')
        rows = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)
        self.assertEqual([(r.name, r.cumplimiento) for r in rows], [('Paseo', '1 de 7')])

    def test_weekly_duplicate_tasks_count_by_name(self):
        # Cada semana se crea otra "Matriz de cumplimiento SH": cuenta la entrega
        # hecha en cualquiera de ellas, una sola vez por nombre.
        p, t = self.project('Axioma', date(2026, 9, 1))
        nueva = Task.objects.create(title='Matriz de cumplimiento SH', project=p, created_by=self.admin)
        Task.objects.filter(pk=nueva.pk).update(created_at=local(2026, 11, 2, 8, 0))
        self.deliver(t['Matriz de cumplimiento SH'], local(2026, 11, 2, 9, 0))
        self.deliver(nueva, local(2026, 11, 3, 9, 0))
        self.deliver(t['KPI'], local(2026, 11, 4, 9, 0))
        row = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)[0]
        self.assertEqual(row.cumplimiento, '2 de 7')
        self.assertEqual(sorted(row.delivery_days), [1, 3])

    def test_workbook_layout_and_values(self):
        _, t1 = self.project('Axioma', date(2026, 9, 1))
        for title in FILES[:5]:
            self.deliver(t1[title], local(2026, 11, 6, 12, 0))
        self.project('Guram', date(2026, 8, 1), status='COMPLETED', end=date(2026, 11, 5))
        rows = collect_rows(Project.objects.all(), self.YEAR, self.WEEK)
        content = build_workbook(rows, self.YEAR, self.WEEK)

        sheets, charts, cells = read_xlsx(content)
        self.assertEqual(sheets, ['Reporte_Estadisticas', 'Grafico de porcentajes', 'Detalle'])
        self.assertEqual(len(charts), 1)
        val = lambda ref: cells[ref][0]
        self.assertEqual([val(f'{c}10') for c in 'ABCDE'],
                         ['Proyecto', 'CRI', 'Cumplimiento esta semana', 'Comentarios', '% Cumplimiento'])
        self.assertEqual(val('A1'), 'Metrica')
        self.assertEqual(val('D1'), 'Codigo color')
        self.assertEqual(val('C11'), 'Entregado')
        self.assertEqual(val('C12'), '5 de 7')
        self.assertTrue(cells['E12'][1].startswith('IFERROR('))
        # Valores ya calculados (se ven sin recalcular).
        self.assertEqual(val('B2'), 7)
        self.assertEqual(val('B3'), 5)
        self.assertEqual(val('B5'), 2)
        self.assertEqual(val('B6'), 5)            # entregas del viernes = día 5
        self.assertAlmostEqual(val('E12'), 5 / 7)
        self.assertEqual(val('E11'), 0)

    def test_filename(self):
        self.assertEqual(week_filename(2026, 45), 'Entregables-Semana-02_al_08_de_Noviembre.xlsx')
        self.assertEqual(week_filename(2026, 49), 'Entregables-Semana-30_de_Noviembre_al_06_de_Diciembre.xlsx')

    def test_endpoint(self):
        client = APIClient()
        client.force_authenticate(self.admin)
        res = client.get('/api/v1/reports/entregables/', {'year': 2026, 'week': 45})
        self.assertEqual(res.status_code, 200)
        self.assertIn('Entregables-Semana-02_al_08_de_Noviembre.xlsx', res['Content-Disposition'])
        self.assertEqual(client.get('/api/v1/reports/entregables/', {'year': 2026, 'week': 60}).status_code, 400)

        client.force_authenticate(self.cri)
        self.assertEqual(client.get('/api/v1/reports/entregables/').status_code, 403)
