"""Eliminar un archivo de una entrega: solo SUPERADMIN, y también en Drive."""
import tempfile
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import RegistroActividad
from apps.documents.models import Document
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()
MEDIA = tempfile.mkdtemp()
DRIVE_ID = '1AbCdEfGhIjKlMnOpQrStUv'
SERVICE = 'apps.documents.submission_files.GoogleDriveService'


@override_settings(MEDIA_ROOT=MEDIA, DEFAULT_FILE_STORAGE='django.core.files.storage.FileSystemStorage')
class SubmissionFileDeleteTests(TestCase):
    def setUp(self):
        self.superadmin = User.objects.create_user(username='sa', email='sa@x.com', password='x', role='SUPERADMIN')
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='ADMIN')
        self.alumno = User.objects.create_user(username='al', email='al@x.com', password='x', role='STUDENT',
                                               first_name='Ana', last_name='López')
        self.project = Project.objects.create(name='Obra', description='d', status='IN_PROGRESS',
                                              created_by=self.superadmin)
        ProjectMember.objects.create(project=self.project, user=self.alumno)
        self.task = Task.objects.create(title='Matriz', project=self.project, created_by=self.superadmin,
                                        status='OPEN')
        self.sub = TaskSubmission.objects.create(
            task=self.task, submitted_by=self.alumno, notes='x',
            files_metadata=[{'name': 'm.pdf', 'gdrive_id': DRIVE_ID}, {'name': 'otro.pdf', 'gdrive_id': 'zzzzzzzzzzzz'}],
        )
        self.doc = Document.objects.create(
            name='m.pdf', file=SimpleUploadedFile('m.pdf', b'PDF'), file_size=3,
            uploaded_by=self.alumno, project=self.project, task=self.task, task_submission=self.sub,
            folder_type='TASK_SUBMISSION', upload_status='COMPLETE', drive_file_id=DRIVE_ID,
            drive_file_url='https://drive.google.com/file/d/x/view',
        )

    def delete_as(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c.delete(f'/api/v1/documents/{self.doc.pk}/')

    def test_solo_superadmin(self):
        with mock.patch(SERVICE) as drive:
            for user in (self.admin, self.alumno):
                self.assertEqual(self.delete_as(user).status_code, 403)
            drive.assert_not_called()
        self.assertTrue(Document.objects.filter(pk=self.doc.pk).exists())

    def test_superadmin_borra_en_la_entrega_y_en_drive(self):
        with mock.patch(SERVICE) as drive:
            drive.return_value.trash_file.return_value = True
            resp = self.delete_as(self.superadmin)
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['deleted_in_drive'])
        drive.assert_called_once_with(use_institutional=True)
        drive.return_value.trash_file.assert_called_once_with(DRIVE_ID)
        self.assertFalse(Document.objects.filter(pk=self.doc.pk).exists())
        self.sub.refresh_from_db()
        self.assertEqual([f['name'] for f in self.sub.files_metadata], ['otro.pdf'])
        log = RegistroActividad.objects.get(accion='ARCHIVO_ELIMINADO')
        self.assertEqual(log.usuario, self.superadmin)
        self.assertEqual(log.tarea_id, self.task.id)
        self.assertIn('m.pdf', log.descripcion)

    def test_si_drive_falla_no_se_borra(self):
        with mock.patch(SERVICE) as drive:
            drive.return_value.trash_file.side_effect = RuntimeError('Drive caído')
            resp = self.delete_as(self.superadmin)
        self.assertEqual(resp.status_code, 502)
        self.assertTrue(Document.objects.filter(pk=self.doc.pk).exists())

    def test_ya_no_existia_en_drive(self):
        with mock.patch(SERVICE) as drive:
            drive.return_value.trash_file.return_value = False
            resp = self.delete_as(self.superadmin)
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.json()['deleted_in_drive'])
        self.assertFalse(Document.objects.filter(pk=self.doc.pk).exists())

    def test_subida_en_curso(self):
        Document.objects.filter(pk=self.doc.pk).update(upload_status='UPLOADING')
        with mock.patch(SERVICE) as drive:
            resp = self.delete_as(self.superadmin)
            drive.assert_not_called()
        self.assertEqual(resp.status_code, 409)
        self.assertTrue(Document.objects.filter(pk=self.doc.pk).exists())

    def test_sin_archivo_en_drive(self):
        Document.objects.filter(pk=self.doc.pk).update(drive_file_id=None, upload_status='FAILED')
        with mock.patch(SERVICE) as drive:
            resp = self.delete_as(self.superadmin)
            drive.assert_not_called()
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Document.objects.filter(pk=self.doc.pk).exists())

    def test_documento_que_no_es_de_entrega_no_cambia(self):
        otro = Document.objects.create(
            name='acta.pdf', file=SimpleUploadedFile('acta.pdf', b'A'), uploaded_by=self.alumno,
            project=self.project, upload_status='COMPLETE',
        )
        c = APIClient()
        c.force_authenticate(self.alumno)
        with mock.patch(SERVICE) as drive:
            self.assertEqual(c.delete(f'/api/v1/documents/{otro.pk}/').status_code, 204)
            drive.assert_not_called()


class TrashFileTests(TestCase):
    def service(self):
        from apps.documents.services import GoogleDriveService
        svc = GoogleDriveService.__new__(GoogleDriveService)
        svc.service = mock.MagicMock()
        return svc

    def test_manda_a_la_papelera(self):
        svc = self.service()
        self.assertTrue(svc.trash_file(DRIVE_ID))
        svc.service.files.return_value.update.assert_called_once_with(
            fileId=DRIVE_ID, body={'trashed': True}, fields='id, trashed', supportsAllDrives=True)

    def test_404_es_que_ya_no_existe(self):
        from googleapiclient.errors import HttpError
        svc = self.service()
        resp = mock.Mock(status=404, reason='Not Found')
        svc.service.files.return_value.update.return_value.execute.side_effect = HttpError(resp, b'{}')
        self.assertFalse(svc.trash_file(DRIVE_ID))

    def test_otros_errores_se_propagan(self):
        from googleapiclient.errors import HttpError
        svc = self.service()
        resp = mock.Mock(status=403, reason='Forbidden')
        svc.service.files.return_value.update.return_value.execute.side_effect = HttpError(resp, b'{}')
        with self.assertRaises(HttpError):
            svc.trash_file(DRIVE_ID)


@override_settings(MEDIA_ROOT=MEDIA, DEFAULT_FILE_STORAGE='django.core.files.storage.FileSystemStorage')
class EmptySubmissionTests(TestCase):
    """Si la entrega se queda sin archivos, se elimina para que el alumno ya no la vea."""

    def setUp(self):
        self.superadmin = User.objects.create_user(username='sa', email='sa@x.com', password='x', role='SUPERADMIN')
        self.alumno = User.objects.create_user(username='al', email='al@x.com', password='x', role='STUDENT')
        self.project = Project.objects.create(name='Obra', description='d', status='IN_PROGRESS',
                                              created_by=self.superadmin)
        self.task = Task.objects.create(title='Matriz', project=self.project, created_by=self.superadmin,
                                        status='OPEN')

    def submission(self, **kw):
        return TaskSubmission.objects.create(task=self.task, submitted_by=self.alumno, notes='x', **kw)

    def document(self, sub, name='m.pdf'):
        return Document.objects.create(
            name=name, file=SimpleUploadedFile(name, b'PDF'), uploaded_by=self.alumno,
            project=self.project, task=self.task, task_submission=sub,
            folder_type='TASK_SUBMISSION', upload_status='COMPLETE', drive_file_id=DRIVE_ID,
        )

    def delete(self, doc):
        c = APIClient()
        c.force_authenticate(self.superadmin)
        with mock.patch(SERVICE) as drive:
            drive.return_value.trash_file.return_value = True
            return c.delete(f'/api/v1/documents/{doc.pk}/')

    def test_entrega_sin_archivos_se_elimina(self):
        sub = self.submission()
        resp = self.delete(self.document(sub))
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()['submission_deleted'])
        self.assertFalse(TaskSubmission.objects.filter(pk=sub.pk).exists())
        log = RegistroActividad.objects.get(accion='ARCHIVO_ELIMINADO')
        self.assertEqual(log.metadata['entrega_id'], sub.pk)
        self.assertTrue(log.metadata['entrega_eliminada'])
        self.assertIsNotNone(log.metadata['documento_id'])

    def test_si_quedan_archivos_o_enlace_se_conserva(self):
        sub = self.submission()
        doc = self.document(sub)
        self.document(sub, 'otro.pdf')
        self.assertFalse(self.delete(doc).json()['submission_deleted'])
        self.assertTrue(TaskSubmission.objects.filter(pk=sub.pk).exists())

        con_enlace = self.submission(link='https://ejemplo.com/evidencia')
        resp = self.delete(self.document(con_enlace))
        self.assertFalse(resp.json()['submission_deleted'])
        self.assertTrue(TaskSubmission.objects.filter(pk=con_enlace.pk).exists())

    def test_vuelve_la_version_anterior_devuelta(self):
        v1 = self.submission(status='SUPERSEDED', graded_at=timezone.now(), teacher_feedback='corrige')
        v2 = self.submission()
        self.assertEqual(v2.version, 2)
        self.delete(self.document(v2))
        self.assertFalse(TaskSubmission.objects.filter(pk=v2.pk).exists())
        v1.refresh_from_db()
        self.assertEqual(v1.status, 'CHANGES_REQUESTED')

    def test_vuelve_la_version_anterior_sin_revisar(self):
        v1 = self.submission(status='SUPERSEDED')
        v2 = self.submission()
        self.delete(self.document(v2))
        v1.refresh_from_db()
        self.assertEqual(v1.status, 'SUBMITTED')

    def test_comando_limpia_entregas_que_ya_quedaron_vacias(self):
        from io import StringIO
        from django.core.management import call_command
        from apps.core.audit import log_activity
        vacia = self.submission()
        con_archivo = self.submission()
        self.document(con_archivo)
        sin_registro = TaskSubmission.objects.create(task=self.task, submitted_by=self.superadmin, notes='solo nota')
        for sub in (vacia, con_archivo):
            log_activity('ARCHIVO_ELIMINADO', 'x', self.superadmin, metadata={'entrega_id': sub.pk})

        out = StringIO()
        call_command('eliminar_entregas_vaciadas', stdout=out)
        self.assertIn(f'Entrega {vacia.pk}', out.getvalue())
        self.assertTrue(TaskSubmission.objects.filter(pk=vacia.pk).exists())  # sin --apply no borra

        call_command('eliminar_entregas_vaciadas', '--apply', stdout=StringIO())
        self.assertFalse(TaskSubmission.objects.filter(pk=vacia.pk).exists())
        self.assertTrue(TaskSubmission.objects.filter(pk=con_archivo.pk).exists())
        self.assertTrue(TaskSubmission.objects.filter(pk=sin_registro.pk).exists())
