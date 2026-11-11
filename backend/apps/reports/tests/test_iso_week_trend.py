"""Tendencia semanal de reportes por semanas ISO 8601 (lunes a domingo)."""
from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.projects.models import Project
from apps.reports.api.views import iso_week_trend
from apps.tasks.models import Task

User = get_user_model()


class IsoWeekTrendTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.project = Project.objects.create(name='P', description='d', status='IN_PROGRESS', created_by=self.admin)

    def done_at(self, *args):
        t = Task.objects.create(title='t', project=self.project, created_by=self.admin, status='COMPLETED')
        local = timezone.make_aware(datetime(*args), timezone.get_current_timezone())
        Task.objects.filter(pk=t.pk).update(updated_at=local)

    def test_groups_by_monday_to_sunday_local(self):
        # Miércoles 11/nov/2026 → semana ISO 46 (lunes 9 – domingo 15)
        today = date(2026, 11, 11)
        self.done_at(2026, 11, 9, 0, 30)    # lunes temprano: semana 46
        self.done_at(2026, 11, 8, 23, 30)   # domingo noche: semana 45
        self.done_at(2026, 11, 2, 10, 0)    # semana 45
        self.done_at(2026, 10, 19, 12, 0)   # semana 43
        self.done_at(2026, 10, 18, 12, 0)   # semana 42: fuera de las 4
        values, labels = iso_week_trend(Task.objects.all(), today, count=4)
        self.assertEqual(labels, ['SEM 43 · 2026', 'SEM 44 · 2026', 'SEM 45 · 2026', 'SEM 46 · 2026'])
        self.assertEqual(values, [1, 0, 2, 1])

    def test_year_boundary_uses_iso_year(self):
        # 1/ene/2027 es viernes de la semana ISO 53 de 2026
        _, labels = iso_week_trend(Task.objects.all(), date(2027, 1, 1), count=2)
        self.assertEqual(labels, ['SEM 52 · 2026', 'SEM 53 · 2026'])
