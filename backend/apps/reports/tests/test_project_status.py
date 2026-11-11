"""Estado actual del proyecto (gráficas de "Progreso del Proyecto")."""
import json
from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.projects.models import Project
from apps.reports.project_status import build_project_status, semaforo
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()
STD = ['Matriz de cumplimiento SH', 'Platicas de seguridad', 'PIRAMIDE SH', 'QR WEEKLY',
       'GRAFICAS', 'Campañas', 'KPI']


def local(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class ProjectStatusTests(TestCase):
    TODAY = date(2026, 11, 11)   # miércoles, semana ISO 46

    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.cri = User.objects.create_user(username='cri', email='c@x.com', password='x', role='STUDENT')
        self.p = Project.objects.create(name='Axioma', description='d', status='IN_PROGRESS', created_by=self.admin,
                                        start_date=date(2026, 10, 19), end_date=date(2027, 1, 17))
        self.tasks = {}
        for t in STD:
            self.tasks[t] = Task.objects.create(title=t, project=self.p, created_by=self.admin)
        Task.objects.filter(project=self.p).update(created_at=local(2026, 10, 19, 9, 0))

    def deliver(self, title, when, **kw):
        s = TaskSubmission.objects.create(task=self.tasks[title], submitted_by=self.cri, notes='ok', **kw)
        TaskSubmission.objects.filter(pk=s.pk).update(created_at=when)

    def test_status(self):
        # Semana 45 (2-8 nov): 5 de 7. Semana 46 (en curso): 1.
        for t in ['Matriz de cumplimiento SH', 'Platicas de seguridad', 'PIRAMIDE SH', 'QR WEEKLY', 'KPI']:
            self.deliver(t, local(2026, 11, 5, 10, 0))
        self.deliver('KPI', local(2026, 11, 10, 10, 0), status='CHANGES_REQUESTED')
        # Inicio 19/oct (semana 43): SEMANA 3 = semana 45.
        g = self.tasks['GRAFICAS']
        g.description = '<!-- GRAFICAS_DATA:%s -->' % json.dumps({'table1': [
            {'semana': 'SEMANA 2', 'actos': 1, 'condiciones': 1, 'ft': 20},
            {'semana': 'SEMANA 3', 'actos': 2, 'condiciones': 0, 'ft': 40},
        ], 'table2': []})
        g.save(update_fields=['description'])

        data = build_project_status(self.p, today=self.TODAY)
        self.assertEqual(data['current']['label'], 'SEM 46')
        self.assertEqual(data['current']['done'], 1)
        self.assertEqual(data['previous']['label'], 'SEM 45')
        self.assertEqual(data['previous']['done'], 6)                 # 5 archivos + gráficas
        self.assertEqual(data['previous']['color'], 'green')
        self.assertEqual(data['previous']['missing'], ['Campañas'])
        # Tendencia desde el inicio del proyecto (semanas 43 a 46).
        self.assertEqual([t['label'] for t in data['trend']], ['SEM 43', 'SEM 44', 'SEM 45', 'SEM 46'])
        # Puntualidad: solo semanas cerradas (43, 44, 45) = 21 entregables.
        punt = data['punctuality']
        self.assertEqual(punt['on_time'] + punt['late'] + punt['missing'], 21)
        self.assertEqual(punt['on_time'], 7)                           # 1 gráfica (sem 44) + 6 de la 45
        # Seguridad: índice = (actos + condiciones) / (FT·50/1000).
        # La gráfica de seguridad va por semana DEL PROYECTO (SEMANA n), no ISO.
        self.assertEqual([s['label'] for s in data['safety']], ['SEMANA 1', 'SEMANA 2', 'SEMANA 3', 'SEMANA 4'])
        sem3 = data['safety'][2]
        self.assertEqual(sem3['indice'], 1.0)                          # 2 / (40·50/1000)
        self.assertEqual(sem3['range'], '2–8 nov')
        self.assertTrue(data['safety'][3]['current'])
        self.assertEqual(data['timeline']['project_week'], 4)
        self.assertEqual(data['timeline']['last_capture'], 'SEMANA 3')
        self.assertEqual(data['timeline']['weeks_without_capture'], 1)
        self.assertEqual(data['timeline']['hh_total'], 3000)
        self.assertEqual(data['review']['changes_requested'], 1)
        self.assertEqual(data['review']['pending'], 5)
        self.assertEqual(data['timeline']['days_elapsed'], 23)
        self.assertEqual(data['timeline']['days_total'], 90)

    def test_semaforo(self):
        self.assertEqual(semaforo(7, 7), 'green')
        self.assertEqual(semaforo(6, 7), 'green')
        self.assertEqual(semaforo(5, 7), 'yellow')
        self.assertEqual(semaforo(2, 7), 'red')
