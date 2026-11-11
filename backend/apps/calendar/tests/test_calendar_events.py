"""Calendario: rango visible, paginación, colores y permisos de edición."""
from datetime import datetime, timedelta, timezone as dt_tz

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.calendar.models import CalendarEvent
from apps.projects.models import Project, ProjectMember

User = get_user_model()
URL = '/api/v1/calendar/calendar-events/'


def utc(*args):
    return datetime(*args, tzinfo=dt_tz.utc)


class CalendarEventTests(TestCase):
    def setUp(self):
        self.prof = User.objects.create_user(username='prof', email='p@x.com', password='x', role='PROFESSOR')
        self.ana = User.objects.create_user(username='ana', email='ana@x.com', password='x', role='STUDENT')
        self.project = Project.objects.create(name='P', description='d', status='IN_PROGRESS', created_by=self.prof)
        for u in (self.prof, self.ana):
            ProjectMember.objects.create(project=self.project, user=u)
        self.client = APIClient()

    def event(self, title, start, end, by=None):
        return CalendarEvent.objects.create(project=self.project, title=title, start_time=start,
                                            end_time=end, created_by=by or self.prof)

    def test_range_includes_events_that_cross_the_boundary(self):
        self.event('octubre', utc(2026, 10, 10, 16), utc(2026, 10, 10, 17))
        self.event('cruza', utc(2026, 10, 30, 16), utc(2026, 11, 2, 17))
        self.event('noviembre', utc(2026, 11, 15, 16), utc(2026, 11, 15, 17))
        self.client.force_authenticate(self.prof)
        res = self.client.get(URL, {'project_id': self.project.id,
                                    'start_date': '2026-11-01T00:00:00Z', 'end_date': '2026-12-01T00:00:00Z'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(sorted(e['title'] for e in res.data['results']), ['cruza', 'noviembre'])

    def test_invalid_dates_are_ignored(self):
        self.event('x', utc(2026, 10, 10, 16), utc(2026, 10, 10, 17))
        self.client.force_authenticate(self.prof)
        res = self.client.get(URL, {'project_id': self.project.id, 'start_date': 'hola'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)

    def test_page_size_allows_more_than_20(self):
        base = utc(2026, 10, 1, 16)
        for i in range(25):
            self.event(f'e{i}', base + timedelta(hours=i * 2), base + timedelta(hours=i * 2 + 1))
        self.client.force_authenticate(self.prof)
        res = self.client.get(URL, {'project_id': self.project.id, 'page_size': 500})
        self.assertEqual(len(res.data['results']), 25)

    def test_purple_and_orange_colors_are_valid(self):
        self.client.force_authenticate(self.prof)
        for color in ('#6f42c1', '#fd7e14'):
            res = self.client.post(URL, {'project': self.project.id, 'title': 'Junta', 'color': color,
                                         'start_time': '2026-11-20T16:00:00Z',
                                         'end_time': '2026-11-20T17:00:00Z'}, format='json')
            self.assertEqual(res.status_code, 201, res.data)

    def test_student_cannot_move_or_delete_professor_event(self):
        ev = self.event('clase', utc(2026, 11, 20, 16), utc(2026, 11, 20, 17))
        self.client.force_authenticate(self.ana)
        res = self.client.get(URL, {'project_id': self.project.id})
        self.assertFalse(res.data['results'][0]['can_edit'])
        self.assertEqual(self.client.patch(f'{URL}{ev.id}/', {'title': 'x'}, format='json').status_code, 403)
        self.assertEqual(self.client.delete(f'{URL}{ev.id}/').status_code, 403)
        self.assertTrue(CalendarEvent.objects.filter(pk=ev.pk, title='clase').exists())

    def test_student_can_edit_own_event_and_professor_any(self):
        mine = self.event('mío', utc(2026, 11, 20, 16), utc(2026, 11, 20, 17), by=self.ana)
        self.client.force_authenticate(self.ana)
        self.assertEqual(self.client.patch(f'{URL}{mine.id}/', {'title': 'mío 2'}, format='json').status_code, 200)
        self.client.force_authenticate(self.prof)
        self.assertEqual(self.client.patch(f'{URL}{mine.id}/', {'title': 'mío 3'}, format='json').status_code, 200)

    def test_partial_update_validates_against_saved_start(self):
        ev = self.event('x', utc(2026, 11, 20, 16), utc(2026, 11, 20, 17))
        self.client.force_authenticate(self.prof)
        res = self.client.patch(f'{URL}{ev.id}/', {'end_time': '2026-11-20T15:00:00Z'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('end_time', res.data)
