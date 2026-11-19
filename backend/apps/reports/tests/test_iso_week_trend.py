"""Tendencia semanal de reportes por semanas ISO 8601 (lunes a domingo)."""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase

from apps.projects.models import Project
from apps.reports.api.views import iso_week_trend
from apps.tasks.models import Task

User = get_user_model()


class IsoWeekTrendTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.project = Project.objects.create(name='P', description='d', status='IN_PROGRESS', created_by=self.admin)

    def done_at(self, y, m, d, *_):
        # Cuenta por FECHA LÍMITE (no por última modificación).
        Task.objects.create(title='t', project=self.project, created_by=self.admin, status='COMPLETED',
                            due_date=date(y, m, d))

    def test_groups_by_monday_to_sunday_local(self):
        # Miércoles 11/nov/2026 → semana ISO 46 (lunes 9 – domingo 15)
        today = date(2026, 11, 11)
        self.done_at(2026, 11, 9)           # lunes: semana 46
        self.done_at(2026, 11, 8)           # domingo: semana 45
        Task.objects.create(title='abierta', project=self.project, created_by=self.admin,
                            status='OPEN', due_date=date(2026, 11, 10))  # no cerrada: no cuenta
        self.done_at(2026, 11, 2, 10, 0)    # semana 45
        self.done_at(2026, 10, 19, 12, 0)   # semana 43
        self.done_at(2026, 10, 18, 12, 0)   # semana 42: fuera de las 4
        values, labels = iso_week_trend(Task.objects.all(), today, count=4)
        self.assertEqual(labels, ['SEM 43 · 2026', 'SEM 44 · 2026', 'SEM 45 · 2026', 'SEM 46 · 2026 (en curso)'])
        self.assertEqual(values, [1, 0, 2, 1])

    def test_year_boundary_uses_iso_year(self):
        # 1/ene/2027 es viernes de la semana ISO 53 de 2026
        _, labels = iso_week_trend(Task.objects.all(), date(2027, 1, 1), count=2)
        self.assertEqual(labels, ['SEM 52 · 2026', 'SEM 53 · 2026 (en curso)'])


class StatisticsIndicatorsTests(TestCase):
    """Criterios de los indicadores de Reportes."""

    def test_indicadores(self):
        from datetime import timedelta
        from rest_framework.test import APIClient
        from apps.tasks.models import TaskSubmission
        admin = User.objects.create_user(username='sa', password='x', role='SUPERADMIN')
        alumno = User.objects.create_user(username='al', password='x', role='STUDENT', first_name='Ana')
        activo = Project.objects.create(name='Activo', status='IN_PROGRESS', created_by=admin)
        terminado = Project.objects.create(name='Fin', status='COMPLETED', created_by=admin)
        from django.utils import timezone
        today = timezone.localdate()

        def t(project, status, days, **kw):
            task = Task.objects.create(title='x', project=project, created_by=admin, status=status,
                                       due_date=today - timedelta(days=days), **kw)
            task.assigned_students.add(alumno)
            return task

        t(activo, 'COMPLETED', 3)                       # cerrada
        t(activo, 'CLOSED', 4)                          # cerrada
        entregada = t(activo, 'OPEN', 5)                # entregada sin cerrar: no vencida
        TaskSubmission.objects.create(task=entregada, submitted_by=alumno)
        t(terminado, 'OPEN', 6)                         # vencida
        t(activo, 'OPEN', 0)                            # vence hoy: en progreso
        t(activo, 'OPEN', 60)                           # fuera de 30 días
        t(activo, 'OPEN', -3)                           # futura: fuera
        t(activo, 'OPEN', 2, is_continuous=True)        # continua: fuera
        t(activo, 'DRAFT', 2)                           # borrador: fuera

        c = APIClient(); c.force_authenticate(admin)
        d = c.get('/api/v1/reports/statistics/?rango=30_dias').json()
        self.assertEqual((d['tareasTotales'], d['tareasCompletadas'], d['tareasVencidas'], d['tareasEnProgreso']),
                         (5, 2, 1, 2))
        self.assertEqual(d['porcentajeCompletado'], 40.0)
        self.assertEqual(d['topPerformers'], [{'name': 'Ana', 'count': 2}])
        self.assertEqual(d['tareasPorProyecto'], [{'project_name': 'Activo', 'task_count': 4}])
