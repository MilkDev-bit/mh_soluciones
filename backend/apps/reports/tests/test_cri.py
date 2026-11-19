from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.projects.models import Project
from apps.reports.models import ProjectCRIOverride
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()


class CRIReportTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='sa', password='x', role='SUPERADMIN')
        self.alumno = User.objects.create_user(username='al', password='x', role='STUDENT')
        today = timezone.localdate()
        self.done = Project.objects.create(name='Terminado', status='COMPLETED', created_by=self.admin,
                                           end_date=today)
        self.active = Project.objects.create(name='Activo', status='IN_PROGRESS', created_by=self.admin)

        def task(project, title, due_delta, **kw):
            return Task.objects.create(title=title, project=project, created_by=self.admin,
                                       due_date=today + timedelta(days=due_delta), status='OPEN', **kw)

        entregada = task(self.done, 'A', -10)
        TaskSubmission.objects.create(task=entregada, submitted_by=self.alumno)
        en_revision = task(self.done, 'B', -5)
        TaskSubmission.objects.create(task=en_revision, submitted_by=self.alumno, status='SUBMITTED')
        Task.objects.filter(pk=task(self.done, 'C', -3).pk).update(status='COMPLETED')
        task(self.done, 'D', -2)                      # vencida sin entrega
        task(self.done, 'E', -1, is_continuous=True)  # continua: no cuenta
        Task.objects.filter(pk=task(self.done, 'F', -1).pk).update(status='DRAFT')  # borrador
        task(self.active, 'X', -1)

        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_calculo_y_solo_completados(self):
        rows = self.client.get('/api/v1/reports/cri/').json()['rows']
        self.assertEqual([r['name'] for r in rows], ['Terminado'])
        r = rows[0]
        self.assertEqual((r['asignadas'], r['terminadas'], r['vencidas'], r['cri']), (4, 3, 1, 75))
        self.assertFalse(r['editado'])

    def test_ajuste_manual_compartido_y_reset(self):
        resp = self.client.put('/api/v1/reports/cri/', {'rows': [
            {'project_id': self.done.id, 'asignadas': 5, 'terminadas': 5, 'vencidas': 0, 'cri': 100},
            {'project_id': self.active.id, 'asignadas': 1, 'terminadas': 1, 'vencidas': 0, 'cri': 100},
        ]}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(ProjectCRIOverride.objects.count(), 1)  # el activo se ignora
        otro = User.objects.create_user(username='ceo', password='x', role='CEO')
        c2 = APIClient(); c2.force_authenticate(otro)
        r = c2.get('/api/v1/reports/cri/').json()['rows'][0]
        self.assertEqual((r['cri'], r['editado']), (100, True))
        self.assertEqual(r['calculado']['cri'], 75)
        self.client.delete('/api/v1/reports/cri/')
        self.assertFalse(ProjectCRIOverride.objects.exists())

    def test_guardar_igual_a_calculado_no_crea_ajuste(self):
        self.client.put('/api/v1/reports/cri/', {'rows': [
            {'project_id': self.done.id, 'asignadas': 4, 'terminadas': 3, 'vencidas': 1, 'cri': 75},
        ]}, format='json')
        self.assertFalse(ProjectCRIOverride.objects.exists())

    def test_solo_admins_editan_y_validacion(self):
        c = APIClient(); c.force_authenticate(self.alumno)
        self.assertEqual(c.put('/api/v1/reports/cri/', {'rows': []}, format='json').status_code, 403)
        resp = self.client.put('/api/v1/reports/cri/', {'rows': [
            {'project_id': self.done.id, 'asignadas': 4, 'terminadas': 3, 'vencidas': 1, 'cri': 150},
        ]}, format='json')
        self.assertEqual(resp.status_code, 400)
