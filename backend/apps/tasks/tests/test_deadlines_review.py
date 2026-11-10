"""
Pruebas del cálculo de plazos (zona horaria, gracia, prórrogas, continuas)
y del flujo de revisión por alumno.
"""
from datetime import date, datetime, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.projects.models import Project, ProjectMember
from apps.tasks import deadlines, review
from apps.tasks.models import Task, TaskReopenLog, TaskSubmission

User = get_user_model()
MX = ZoneInfo('America/Mexico_City')


def mx(*args):
    return datetime(*args, tzinfo=MX)


class Base(TestCase):
    def setUp(self):
        self.teacher = User.objects.create_user(username='prof', email='p@x.com', password='x',
                                                role='PROFESSOR', first_name='Ana', last_name='Prof')
        self.teacher2 = User.objects.create_user(username='prof2', email='p2@x.com', password='x',
                                                 role='PROFESSOR', first_name='Beto', last_name='Prof')
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x',
                                              role='SUPERADMIN')
        self.student = User.objects.create_user(username='alu', email='s@x.com', password='x',
                                                role='STUDENT', first_name='Ale', last_name='Alu')
        self.other = User.objects.create_user(username='alu2', email='s2@x.com', password='x',
                                              role='STUDENT')
        self.project = Project.objects.create(name='P', description='d', status='IN_PROGRESS',
                                              created_by=self.teacher)
        ProjectMember.objects.create(project=self.project, user=self.student)
        ProjectMember.objects.create(project=self.project, user=self.other)

    def make_task(self, **kw):
        defaults = dict(title='Tarea', project=self.project, created_by=self.teacher, status='OPEN')
        defaults.update(kw)
        t = Task.objects.create(**defaults)
        t.assigned_students.set([self.student, self.other])
        return t

    def client_for(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c


class DeadlineTests(Base):
    def test_due_date_vence_al_final_del_dia_local(self):
        """'15/11' vence a las 23:59 de México, no a las 00:00 ni en UTC."""
        t = self.make_task(due_date=date(2026, 11, 15))
        self.assertEqual(deadlines.task_deadline(t), mx(2026, 11, 15, 23, 59, 59))
        # 20:00 local del 15 = 02:00 UTC del 16: antes ya se marcaba vencida
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 15, 20, 0))
        self.assertTrue(w.can_submit)
        self.assertEqual(w.state, deadlines.STATE_DUE_SOON)
        # 00:30 local del 16 sí está vencida
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 16, 0, 30))
        self.assertEqual(w.state, deadlines.STATE_OVERDUE)
        self.assertIn('15/11/2026 23:59', w.message)

    def test_close_date_tiene_prioridad_y_sincroniza_due_date(self):
        c = self.client_for(self.teacher)
        resp = c.post('/api/v1/tasks/', {
            'title': 'X', 'project': self.project.pk, 'status': 'OPEN',
            'due_date': '2026-11-20',
            # 23:00 en México = 05:00 UTC del día siguiente
            'close_date': '2026-11-15T23:00:00-06:00',
        }, format='json')
        self.assertEqual(resp.status_code, 201, resp.data)
        t = Task.objects.get(title='X')
        self.assertEqual(t.due_date, date(2026, 11, 15))

    def test_dias_de_gracia(self):
        t = self.make_task(due_date=date(2026, 11, 15), allow_late_submissions=True, days_after_close=2)
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 17, 12, 0))
        self.assertEqual(w.state, deadlines.STATE_LATE_WINDOW)
        self.assertTrue(w.can_submit and w.is_late)
        self.assertIn('17/11/2026 23:59', w.message)
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 18, 0, 1))
        self.assertEqual(w.state, deadlines.STATE_OVERDUE)
        self.assertIn('periodo de entregas tardías', w.message)

    def test_tardias_sin_limite(self):
        t = self.make_task(due_date=date(2026, 1, 1), allow_late_submissions=True, days_after_close=0)
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 1))
        self.assertEqual(w.state, deadlines.STATE_LATE_WINDOW)

    def test_actividad_continua_nunca_vence(self):
        t = self.make_task(title='GRAFICAS', due_date=date(2025, 1, 1), is_continuous=True)
        w = deadlines.submission_window(t, self.student, now=mx(2026, 11, 10))
        self.assertEqual(w.state, deadlines.STATE_NO_DEADLINE)
        self.assertTrue(w.can_submit)

    def test_prorroga_solo_para_un_alumno(self):
        t = self.make_task(due_date=date(2026, 11, 1))
        log = TaskReopenLog.objects.create(task=t, reopened_by=self.teacher,
                                           new_deadline=mx(2026, 11, 20, 23, 59, 59))
        log.specific_students.set([self.student])
        now = mx(2026, 11, 10)
        self.assertTrue(deadlines.submission_window(t, self.student, now=now).can_submit)
        self.assertFalse(deadlines.submission_window(t, self.other, now=now).can_submit)


class SubmitApiTests(Base):
    def url(self, t):
        return f'/api/v1/tasks/{t.pk}/submissions/'

    def test_entrega_vencida_responde_motivo_claro(self):
        t = self.make_task(due_date=timezone.localdate() - timedelta(days=3))
        resp = self.client_for(self.student).post(self.url(t), {'notes': 'hola'}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['code'], 'OVERDUE')
        self.assertIn('no acepta entregas tardías', resp.data['error'])
        self.assertIn('prórroga', resp.data['error'])

    def test_entrega_tardia_queda_por_revisar_y_marcada(self):
        t = self.make_task(due_date=timezone.localdate() - timedelta(days=1),
                           allow_late_submissions=True, days_after_close=5)
        resp = self.client_for(self.student).post(self.url(t), {'notes': 'tarde'}, format='multipart')
        self.assertEqual(resp.status_code, 201, resp.data)
        sub = TaskSubmission.objects.get(task=t)
        self.assertEqual(sub.status, 'SUBMITTED')
        self.assertTrue(sub.is_late)
        self.assertIn('tardía', resp.data['message'])

    def test_nueva_version_reemplaza_la_anterior(self):
        t = self.make_task(due_date=timezone.localdate() + timedelta(days=3))
        c = self.client_for(self.student)
        c.post(self.url(t), {'notes': 'v1'}, format='multipart')
        c.post(self.url(t), {'notes': 'v2'}, format='multipart')
        v1, v2 = TaskSubmission.objects.filter(task=t).order_by('version')
        self.assertEqual(v1.status, 'SUPERSEDED')
        self.assertEqual(v2.status, 'SUBMITTED')

    def test_alumno_no_puede_autocalificarse(self):
        t = self.make_task(due_date=timezone.localdate() + timedelta(days=3))
        c = self.client_for(self.student)
        c.post(self.url(t), {'notes': 'v1'}, format='multipart')
        sub = TaskSubmission.objects.get(task=t)
        c.patch(f'{self.url(t)}{sub.pk}/', {'status': 'GRADED', 'score': 100}, format='multipart')
        sub.refresh_from_db()
        self.assertEqual(sub.status, 'SUBMITTED')
        self.assertIsNone(sub.score)

    def test_alumno_no_puede_cambiar_estado_ni_fechas_de_la_tarea(self):
        t = self.make_task(due_date=timezone.localdate())
        c = self.client_for(self.student)
        resp = c.patch(f'/api/v1/tasks/{t.pk}/', {'status': 'COMPLETED'}, format='json')
        self.assertEqual(resp.status_code, 403)
        resp = c.patch(f'/api/v1/tasks/{t.pk}/',
                       {'description': '<!-- GRAFICAS_DATA:{} -->'}, format='json')
        self.assertEqual(resp.status_code, 200)


class ReviewFlowTests(Base):
    def setUp(self):
        super().setUp()
        self.task = self.make_task(due_date=timezone.localdate() + timedelta(days=3))
        self.sub = TaskSubmission.objects.create(task=self.task, submitted_by=self.student, notes='x')

    def test_un_revisor_bloquea_a_otro(self):
        review.claim(self.sub.pk, self.teacher)
        with self.assertRaises(review.ReviewError) as ctx:
            review.decide(self.sub.pk, self.teacher2, 'approve', score=90)
        self.assertEqual(ctx.exception.code, 'TAKEN_BY_OTHER')
        self.assertIn('Ana Prof', ctx.exception.message)
        # Un administrador sí puede reasignar
        review.claim(self.sub.pk, self.admin, force=True)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.reviewer, self.admin)

    def test_devolver_exige_comentario_y_permite_corregir_aunque_haya_vencido(self):
        with self.assertRaises(review.ReviewError):
            review.decide(self.sub.pk, self.teacher, 'request_changes', feedback='  ')
        with self.captureOnCommitCallbacks(execute=True):
            review.decide(self.sub.pk, self.teacher, 'request_changes', feedback='Falta firma')
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'CHANGES_REQUESTED')
        # Aunque la tarea venza, puede reenviar dentro de los días de corrección
        later = timezone.now() + timedelta(days=4)
        self.task.due_date = timezone.localdate() - timedelta(days=1)
        w = deadlines.submission_window(self.task, self.student, latest_submission=self.sub,
                                        now=timezone.now() + timedelta(days=1))
        self.assertEqual(w.state, deadlines.STATE_CORRECTION)
        self.assertTrue(w.can_submit)
        w = deadlines.submission_window(self.task, self.student, latest_submission=self.sub, now=later)
        self.assertFalse(w.can_submit)

    def test_mensajes_distintos_para_aprobada_y_devuelta(self):
        from apps.notifications.models import Notification
        with self.captureOnCommitCallbacks(execute=True):
            review.decide(self.sub.pk, self.teacher, 'request_changes', feedback='Corrige la tabla')
        n = Notification.objects.filter(user=self.student).latest('id')
        self.assertEqual(n.title, 'Entrega devuelta con cambios')
        self.assertIn('Corrige la tabla', n.message)
        self.assertNotIn('calificada', n.message.lower())

        sub2 = TaskSubmission.objects.create(task=self.task, submitted_by=self.student, notes='v2')
        with self.captureOnCommitCallbacks(execute=True):
            review.decide(sub2.pk, self.teacher, 'approve', score=95)
        n = Notification.objects.filter(user=self.student).latest('id')
        self.assertEqual(n.title, 'Entrega aprobada')
        self.assertIn('95', n.message)

    def test_no_se_revisa_una_version_reemplazada(self):
        TaskSubmission.objects.create(task=self.task, submitted_by=self.student, notes='v2')
        with self.assertRaises(review.ReviewError) as ctx:
            review.decide(self.sub.pk, self.teacher, 'approve')
        self.assertEqual(ctx.exception.code, 'SUPERSEDED')

    def test_tablero_incluye_alumnos_sin_entrega(self):
        resp = self.client_for(self.teacher).get(f'/api/v1/tasks/{self.task.pk}/review-board/')
        self.assertEqual(resp.status_code, 200)
        states = {r['student']['id']: r['state'] for r in resp.data['rows']}
        self.assertEqual(states[self.student.pk], 'TO_REVIEW')
        self.assertEqual(states[self.other.pk], 'MISSING')
        self.assertEqual(resp.data['summary']['missing'], 1)

    def test_grade_legacy_no_aprueba_debajo_del_minimo(self):
        c = self.client_for(self.teacher)
        resp = c.post(f'/api/v1/tasks/{self.task.pk}/submissions/{self.sub.pk}/grade/',
                      {'score': 50, 'status': 'GRADED'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.sub.refresh_from_db()
        self.assertEqual(self.sub.status, 'CHANGES_REQUESTED')

    def test_my_tasks_clasifica_correctamente(self):
        overdue = self.make_task(title='Vieja', due_date=timezone.localdate() - timedelta(days=5))
        continua = self.make_task(title='GRAFICAS', due_date=timezone.localdate() - timedelta(days=30),
                                  is_continuous=True)
        review.decide(self.sub.pk, self.teacher, 'request_changes', feedback='Ajusta')
        resp = self.client_for(self.student).get('/api/v1/tasks/my-tasks/')
        ids = {k: [t['id'] for t in v] for k, v in resp.data.items()}
        self.assertIn(overdue.pk, ids['overdue'])
        self.assertIn(continua.pk, ids['to_submit'])
        self.assertIn(self.task.pk, ids['changes_requested'])


class UtcSchedulingTests(Base):
    def test_duplicar_cierra_domingo_14h_local(self):
        t = self.make_task(due_date=date(2026, 11, 1), status='COMPLETED')
        # Sábado 7/11/2026 19:00 en México = domingo 01:00 UTC
        fake_now = mx(2026, 11, 7, 19, 0)
        with mock.patch('django.utils.timezone.now', return_value=fake_now.astimezone(ZoneInfo('UTC'))):
            resp = self.client_for(self.admin).post(f'/api/v1/tasks/{t.pk}/duplicate/')
        self.assertEqual(resp.status_code, 201, resp.data)
        new = Task.objects.exclude(pk=t.pk).get(title=t.title)
        self.assertEqual(timezone.localtime(new.close_date), mx(2026, 11, 8, 14, 0))
        self.assertEqual(new.due_date, date(2026, 11, 8))

    def test_recordatorio_3_dias_no_truena(self):
        from apps.tasks.tasks import send_task_due_reminders
        self.make_task(due_date=timezone.localdate() + timedelta(days=3))
        with mock.patch('apps.tasks.tasks.send_task_due_reminder') as send:
            result = send_task_due_reminders()
        self.assertEqual(result['sent'], 1)
        send.assert_called_once()

    def test_aviso_de_vencida_una_sola_vez_y_solo_a_quien_no_entrego(self):
        from apps.notifications.models import Notification
        from apps.notifications.tasks import verificar_tareas_vencidas
        t = self.make_task(due_date=timezone.localdate() - timedelta(days=2))
        TaskSubmission.objects.create(task=t, submitted_by=self.student, notes='x')
        self.make_task(title='GRAFICAS', due_date=timezone.localdate() - timedelta(days=9),
                       is_continuous=True)
        verificar_tareas_vencidas()
        verificar_tareas_vencidas()
        avisos = Notification.objects.filter(notification_type='TASK_OVERDUE')
        self.assertEqual(avisos.count(), 1)
        self.assertEqual(avisos.get().user, self.other)


class SameProjectVisibilityTests(Base):
    """Tareas de un mismo proyecto asignadas a usuarios distintos."""

    def setUp(self):
        super().setUp()
        past = timezone.localdate() - timedelta(days=2)
        self.mine = Task.objects.create(title='Mía', project=self.project, created_by=self.teacher,
                                        status='OPEN', due_date=past)
        self.mine.assigned_students.set([self.student])
        self.theirs = Task.objects.create(title='De otro', project=self.project, created_by=self.teacher,
                                          status='OPEN', due_date=past)
        self.theirs.assigned_students.set([self.other])
        self.theirs_direct = Task.objects.create(title='De otro directa', project=self.project,
                                                 created_by=self.teacher, status='OPEN',
                                                 due_date=past, assigned_to=self.other)
        self.general = Task.objects.create(title='General', project=self.project,
                                           created_by=self.teacher, status='OPEN')

    def test_alumno_no_ve_tareas_asignadas_a_otros_del_mismo_proyecto(self):
        resp = self.client_for(self.student).get(f'/api/v1/tasks/?project={self.project.pk}')
        titles = {t['title'] for t in resp.data['results']}
        self.assertIn('Mía', titles)
        self.assertIn('General', titles)
        self.assertNotIn('De otro', titles)
        self.assertNotIn('De otro directa', titles)

    def test_tarea_general_no_cuenta_como_pendiente_ni_vencida(self):
        resp = self.client_for(self.student).get(f'/api/v1/tasks/?project={self.project.pk}')
        by_title = {t['title']: t for t in resp.data['results']}
        self.assertIsNone(by_title['General']['my_window'])
        self.assertEqual(by_title['Mía']['my_window']['state'], 'OVERDUE')

    def test_no_puede_entregar_ni_ver_entregas_de_tarea_ajena(self):
        TaskSubmission.objects.create(task=self.theirs, submitted_by=self.other, notes='x')
        c = self.client_for(self.student)
        resp = c.post(f'/api/v1/tasks/{self.theirs.pk}/submissions/', {'notes': 'y'}, format='multipart')
        self.assertEqual(resp.status_code, 403)
        resp = c.get(f'/api/v1/tasks/{self.theirs.pk}/submissions/')
        rows = resp.data['results'] if isinstance(resp.data, dict) else resp.data
        self.assertEqual(len(rows), 0)
