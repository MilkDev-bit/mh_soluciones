"""Estado general de las obras en proceso (Panel de Control)."""
import json
from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.projects.models import Project
from apps.reports.general_status import build_general_status
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()
STD = ['Matriz de cumplimiento SH', 'Platicas de seguridad', 'PIRAMIDE SH', 'QR WEEKLY',
       'GRAFICAS', 'Campañas', 'KPI']


def local(*args):
    return timezone.make_aware(datetime(*args), timezone.get_current_timezone())


class GeneralStatusTests(TestCase):
    TODAY = date(2026, 11, 11)   # semana ISO 46; la anterior (cerrada) es la 45

    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.cri = User.objects.create_user(username='cri', email='c@x.com', password='x', role='STUDENT')

    def project(self, name, status='IN_PROGRESS', start=date(2026, 10, 19)):
        p = Project.objects.create(name=name, description='d', status=status, created_by=self.admin, start_date=start)
        tasks = {t: Task.objects.create(title=t, project=p, created_by=self.admin) for t in STD}
        Task.objects.filter(project=p).update(created_at=local(2026, 10, 19, 9, 0))
        return p, tasks

    def deliver(self, task, when):
        s = TaskSubmission.objects.create(task=task, submitted_by=self.cri, notes='ok')
        TaskSubmission.objects.filter(pk=s.pk).update(created_at=when)

    def test_general(self):
        _, a = self.project('Axioma')
        for t in STD:
            if t != 'GRAFICAS':
                self.deliver(a[t], local(2026, 11, 5, 10, 0))          # 6 de 7 en la 45
        # Inicio 19/oct (lunes): SEMANA 3 = semana ISO 45.
        g = a['GRAFICAS']
        g.description = '<!-- GRAFICAS_DATA:%s -->' % json.dumps({'table1': [
            {'semana': 'SEMANA 3', 'actos': 2, 'condiciones': 0, 'ft': 40}], 'table2': []})
        g.save(update_fields=['description'])
        _, b = self.project('Buenavista')
        self.deliver(b['KPI'], local(2026, 11, 4, 10, 0))               # 1 de 7 en la 45
        self.project('Cerrado', status='COMPLETED')                     # no cuenta

        data = build_general_status(Project.objects.all(), today=self.TODAY)
        self.assertEqual(data['active_projects'], 2)
        prev = data['previous']
        self.assertEqual(prev['label'], 'SEM 45')
        self.assertEqual((prev['done'], prev['total']), (8, 14))       # 7 (6 + gráficas) + 1
        self.assertEqual((prev['green'], prev['yellow'], prev['red']), (1, 0, 1))
        self.assertEqual(prev['top_missing'][0]['projects'], 1)
        # Solo Buenavista requiere atención.
        self.assertEqual([a['name'] for a in data['attention']], ['Buenavista'])
        self.assertEqual(data['attention'][0]['color'], 'red')
        # Índice general de la semana 45: 2 / (40·50/1000) = 1.0
        sem45 = next(s for s in data['safety'] if s['label'] == 'SEM 45')
        self.assertEqual(sem45['indice'], 1.0)
        # Gráficas sin capturar en la semana 45: Buenavista.
        self.assertEqual([p['name'] for p in data['graficas']['without_capture']], ['Buenavista'])
        self.assertEqual(data['review']['pending'], 7)
        self.assertEqual(len(data['trend']), 10)

    def test_endpoint_permissions(self):
        self.project('Axioma')
        client = APIClient()
        client.force_authenticate(self.admin)
        res = client.get('/api/v1/reports/general-status/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('trend', res.data)
        for role in ('CEO', 'RH', 'STUDENT'):
            u = User.objects.create_user(username=role.lower(), email=f'{role}@x.com', password='x', role=role)
            client.force_authenticate(u)
            self.assertEqual(client.get('/api/v1/reports/general-status/').status_code, 403)
