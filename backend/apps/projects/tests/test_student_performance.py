"""Desempeño de estudiantes: solo cuenta las tareas del proyecto consultado."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()


class StudentPerformanceTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.ana = User.objects.create_user(username='ana', email='ana@x.com', password='x', role='STUDENT',
                                            first_name='Ana', last_name='López')
        self.p1 = Project.objects.create(name='Uno', description='d', status='IN_PROGRESS', created_by=self.admin)
        self.p2 = Project.objects.create(name='Dos', description='d', status='IN_PROGRESS', created_by=self.admin)
        for p in (self.p1, self.p2):
            ProjectMember.objects.create(project=p, user=self.ana)
        today = timezone.localdate()

        def task(project, days, **kw):
            t = Task.objects.create(title=f't{days}', project=project, created_by=self.admin, status='OPEN',
                                    due_date=today + timedelta(days=days), **kw)
            t.assigned_students.set([self.ana])
            return t

        # Proyecto 1: a tiempo (con 3 versiones), tardía, sin entregar, pendiente y una continua
        a_tiempo = task(self.p1, -3)
        for _ in range(3):
            s = TaskSubmission.objects.create(task=a_tiempo, submitted_by=self.ana, notes='x')
            TaskSubmission.objects.filter(pk=s.pk).update(created_at=timezone.now() - timedelta(days=5))
        tardia = task(self.p1, -6)
        s = TaskSubmission.objects.create(task=tardia, submitted_by=self.ana, notes='x')
        TaskSubmission.objects.filter(pk=s.pk).update(created_at=timezone.now() - timedelta(days=1))
        task(self.p1, -2)                       # sin entregar
        task(self.p1, 5)                        # pendiente (aún no vence)
        task(self.p1, -30, is_continuous=True)  # GRAFICAS: no cuenta

        # Proyecto 2: 10 tareas entregadas a tiempo que NO deben contar en el 1
        for i in range(10):
            t = task(self.p2, 3 + i)
            TaskSubmission.objects.create(task=t, submitted_by=self.ana, notes='x')

    def get(self, project):
        c = APIClient()
        c.force_authenticate(self.admin)
        r = c.get(f'/api/v1/projects/{project.pk}/student-performance/')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data['students'][0]

    def test_solo_tareas_del_proyecto_y_por_tarea_no_por_version(self):
        ana = self.get(self.p1)
        self.assertEqual(ana['assigned_tasks'], 4)
        self.assertEqual(ana['on_time_submissions'], 1)   # 3 versiones = 1 tarea
        self.assertEqual(ana['late_submissions'], 1)
        self.assertEqual(ana['missed_tasks'], 1)
        self.assertEqual(ana['pending_tasks'], 1)
        self.assertEqual(ana['on_time_percentage'], 33)  # 1 de 3 evaluadas

        ana2 = self.get(self.p2)
        self.assertEqual(ana2['assigned_tasks'], 10)
        self.assertEqual(ana2['on_time_submissions'], 10)
        self.assertEqual(ana2['on_time_percentage'], 100)
