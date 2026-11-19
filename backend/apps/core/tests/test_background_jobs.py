"""
Correos en segundo plano, candado de carpetas de Drive, token de Google y
tareas programadas que se activan con el servicio de Celery.
"""
import threading
import time
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.core import background


class DispatchEmailTests(TestCase):
    def setUp(self):
        background._CHECK.update(value=None, checked_at=0.0)

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_sin_worker_se_envia_en_un_hilo_sin_bloquear(self):
        from utils.email_notifications import dispatch_email
        started = threading.Event()
        release = threading.Event()

        def slow_deliver(*args):
            started.set()
            release.wait(5)

        with mock.patch('apps.core.background.celery_worker_available', return_value=False), \
                mock.patch('utils.email_notifications.deliver_email', side_effect=slow_deliver):
            t0 = time.monotonic()
            self.assertTrue(dispatch_email('Asunto', 'Cuerpo', ['a@x.com']))
            # Respondió aunque el SMTP "sigue enviando"
            self.assertLess(time.monotonic() - t0, 1)
            self.assertTrue(started.wait(2))
            release.set()

    def test_por_defecto_el_correo_sale_del_servicio_web(self):
        from utils.email_notifications import dispatch_email
        with mock.patch('apps.core.background.celery_worker_available', return_value=True), \
                mock.patch('apps.core.tasks.send_rendered_email.delay') as delay, \
                mock.patch('apps.core.background.run_in_thread') as thread:
            dispatch_email('Asunto', 'Cuerpo', ['a@x.com'])
        delay.assert_not_called()
        thread.assert_called_once()

    @override_settings(EMAIL_VIA_CELERY=True)
    def test_con_worker_se_encola_en_celery(self):
        from utils.email_notifications import dispatch_email
        with mock.patch('apps.core.background.celery_worker_available', return_value=True), \
                mock.patch('apps.core.tasks.send_rendered_email.delay') as delay, \
                mock.patch('apps.core.background.run_in_thread') as thread:
            dispatch_email('Asunto', 'Cuerpo', ['a@x.com'], '<p>x</p>')
        delay.assert_called_once_with('Asunto', 'Cuerpo', ['a@x.com'], '<p>x</p>')
        thread.assert_not_called()

    @override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
    def test_dentro_del_worker_se_envia_directo(self):
        from utils.email_notifications import dispatch_email
        with mock.patch.dict('os.environ', {'CELERY_WORKER_PROCESS': '1'}):
            dispatch_email('Asunto', 'Cuerpo', ['a@x.com'])
        self.assertEqual(len(mail.outbox), 1)

    def test_fallo_smtp_no_se_registra_como_enviado(self):
        from utils.email_notifications import deliver_email
        with mock.patch('utils.email_notifications.send_mail', side_effect=OSError('timeout')):
            with self.assertLogs('utils.email_notifications', level='ERROR'):
                self.assertFalse(deliver_email('A', 'B', ['a@x.com']))

    @override_settings(EMAIL_TIMEOUT=20)
    def test_hay_timeout_smtp(self):
        from django.conf import settings
        self.assertEqual(settings.EMAIL_TIMEOUT, 20)


class DriveUploadRoutingTests(TestCase):
    @override_settings(DRIVE_UPLOADS_VIA_CELERY=False)
    def test_subidas_no_van_a_celery_con_volumen_local(self):
        from apps.documents.api.views import _is_celery_worker_available
        with mock.patch('apps.core.background.celery_worker_available', return_value=True):
            self.assertFalse(_is_celery_worker_available())

    @override_settings(DRIVE_UPLOADS_VIA_CELERY=True)
    def test_subidas_a_celery_si_se_activa(self):
        from apps.documents.api.views import _is_celery_worker_available
        with mock.patch('apps.core.background.celery_worker_available', return_value=True):
            self.assertTrue(_is_celery_worker_available())


class FolderLockTests(TestCase):
    def test_subidas_simultaneas_crean_una_sola_carpeta(self):
        from apps.documents.services import GoogleDriveService
        cache.clear()
        created = []
        lock = threading.Lock()

        def make_service():
            svc = GoogleDriveService.__new__(GoogleDriveService)
            svc.service = mock.MagicMock()

            def list_(**kwargs):
                req = mock.MagicMock()
                # Drive tarda en "ver" la carpeta nueva: la búsqueda nunca la encuentra
                req.execute.return_value = {'files': []}
                return req

            def create(**kwargs):
                req = mock.MagicMock()
                with lock:
                    created.append(1)
                    n = len(created)
                time.sleep(0.2)
                req.execute.return_value = {'id': f'folder{n}', 'name': 'X'}
                return req

            svc.service.files.return_value.list.side_effect = list_
            svc.service.files.return_value.create.side_effect = create
            return svc

        results = []

        def run():
            results.append(make_service()._get_or_create_folder('BAE PALOMAS', 'parent123456'))

        threads = [threading.Thread(target=run) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(10)
        self.assertEqual(len(created), 1)
        self.assertEqual(set(results), {'folder1'})


class DriveTokenTests(TestCase):
    def test_token_renovado_se_guarda_y_se_reutiliza(self):
        from apps.authentication.models import CustomUser, GoogleApiCredentials
        from apps.documents.services import GoogleDriveService
        cache.clear()
        user = CustomUser.objects.create_user(username='soporte', password='x')
        GoogleApiCredentials.objects.create(
            user=user, access_token='viejo-token-000000000000', refresh_token='refresh',
            token_uri='https://oauth2.googleapis.com/token', client_id='cid',
            client_secret='sec', scopes='https://www.googleapis.com/auth/drive',
        )
        refreshes = []

        def fake_refresh(creds, request):
            refreshes.append(1)
            creds.token = f'nuevo-token-{len(refreshes):012d}'
            creds.expiry = (timezone.now() + timedelta(hours=1)).replace(tzinfo=None)

        with mock.patch('google.oauth2.credentials.Credentials.refresh', autospec=True,
                        side_effect=fake_refresh), \
                mock.patch('apps.documents.services.build') as build:
            GoogleDriveService(user=user)
            GoogleDriveService(user=user)
            GoogleDriveService(user=user)

        self.assertEqual(len(refreshes), 1)
        self.assertEqual(GoogleApiCredentials.objects.get(user=user).access_token,
                         'nuevo-token-000000000001')
        self.assertFalse(build.call_args.kwargs['cache_discovery'])


class ScheduledTasksTests(TestCase):
    def test_programadas_peligrosas_no_estan_activas(self):
        from django.conf import settings
        tasks = {v['task'] for v in settings.CELERY_BEAT_SCHEDULE.values()}
        self.assertNotIn('sync_deleted_drive_files_task', tasks)
        self.assertNotIn('apps.tasks.tasks.assign_tasks_to_students_weekly', tasks)

    def test_todas_las_programadas_estan_registradas(self):
        from django.conf import settings
        from config.celery import app
        app.loader.import_default_modules()
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            self.assertIn(entry['task'], app.tasks, entry['task'])
        self.assertIn('send_rendered_email', app.tasks)


class ScheduledTasksRunTests(TestCase):
    """Nunca habían corrido en producción: deben ejecutarse sin errores."""

    def test_todas_las_programadas_corren(self):
        from django.conf import settings
        from config.celery import app
        app.loader.import_default_modules()
        for entry in settings.CELERY_BEAT_SCHEDULE.values():
            with self.subTest(entry['task']):
                app.tasks[entry['task']].apply().get()

    def test_tareas_vencidas_solo_ultimos_7_dias(self):
        from apps.authentication.models import CustomUser
        from apps.notifications.models import Notification
        from apps.notifications.tasks import verificar_tareas_vencidas
        from apps.projects.models import Project
        from apps.tasks.models import Task
        admin = CustomUser.objects.create_user(username='adm', password='x', role='ADMIN')
        alumno = CustomUser.objects.create_user(username='alu', password='x', role='STUDENT')
        project = Project.objects.create(name='P', status='IN_PROGRESS', created_by=admin)
        hoy = timezone.localdate()
        vieja = Task.objects.create(title='Vieja', project=project, created_by=admin,
                                    due_date=hoy - timedelta(days=40), status='OPEN')
        reciente = Task.objects.create(title='Reciente', project=project, created_by=admin,
                                       due_date=hoy - timedelta(days=2), status='OPEN')
        for t in (vieja, reciente):
            t.assigned_students.add(alumno)
        verificar_tareas_vencidas()
        titulos = set(Notification.objects.filter(user=alumno).values_list('title', flat=True))
        self.assertNotIn('Tarea vencida: Vieja', titulos)


class StaleUploadTaskTests(TestCase):
    """Tareas de subida viejas en Redis no deben dañar documentos ya subidos."""

    def make_doc(self, **kw):
        from django.core.files.base import ContentFile
        from apps.authentication.models import CustomUser
        from apps.documents.models import Document
        user = CustomUser.objects.create_user(username=f'u{Document.objects.count()}', password='x')
        doc = Document(uploaded_by=user, folder_type='DOCUMENTOS', **kw)
        doc.file.save('a.txt', ContentFile(b'x'), save=False)
        doc.save()
        return doc

    @override_settings(DRIVE_UPLOADS_VIA_CELERY=False)
    def test_worker_ignora_subidas_si_no_estan_activadas(self):
        from apps.documents.models import Document
        from apps.documents.tasks import upload_document_to_drive
        doc = self.make_doc(upload_status=Document.UploadStatus.COMPLETE, drive_file_id='abc123')
        with mock.patch.dict('os.environ', {'CELERY_WORKER_PROCESS': '1'}), \
                mock.patch('apps.documents.tasks.GoogleDriveService') as drive:
            upload_document_to_drive.apply(args=[doc.id]).get()
        drive.assert_not_called()
        doc.refresh_from_db()
        self.assertEqual(doc.upload_status, Document.UploadStatus.COMPLETE)

    def test_documento_ya_subido_no_se_toca(self):
        from apps.documents.models import Document
        from apps.documents.tasks import upload_document_to_drive
        doc = self.make_doc(upload_status=Document.UploadStatus.COMPLETE, drive_file_id='abc123')
        with mock.patch('apps.documents.tasks.GoogleDriveService') as drive:
            upload_document_to_drive(doc.id)
        drive.assert_not_called()
        doc.refresh_from_db()
        self.assertEqual(doc.upload_status, Document.UploadStatus.COMPLETE)

    @override_settings(DRIVE_UPLOADS_VIA_CELERY=True)
    def test_archivo_ausente_en_worker_no_cambia_estado(self):
        from apps.documents.models import Document
        from apps.documents.tasks import upload_document_to_drive
        doc = self.make_doc(upload_status=Document.UploadStatus.PENDING)
        doc.file.storage.delete(doc.file.name)
        with mock.patch.dict('os.environ', {'CELERY_WORKER_PROCESS': '1'}), \
                mock.patch('apps.documents.tasks.GoogleDriveService') as drive:
            upload_document_to_drive.apply(args=[doc.id]).get()
        drive.assert_not_called()
        doc.refresh_from_db()
        self.assertEqual(doc.upload_status, Document.UploadStatus.PENDING)


class TaskTitleFilterTests(TestCase):
    def test_title_contains_filtra_tareas(self):
        from rest_framework.test import APIClient
        from apps.authentication.models import CustomUser
        from apps.projects.models import Project
        from apps.tasks.models import Task
        admin = CustomUser.objects.create_user(username='adm2', password='x', role='ADMIN')
        p = Project.objects.create(name='P', status='IN_PROGRESS', created_by=admin)
        Task.objects.create(title='GRAFICAS', project=p, created_by=admin)
        Task.objects.create(title='KPI', project=p, created_by=admin)
        client = APIClient(); client.force_authenticate(admin)
        data = client.get('/api/v1/tasks/?title_contains=GRAFICAS&page_size=1000').json()
        items = data.get('results', data)
        self.assertEqual([t['title'] for t in items], ['GRAFICAS'])
