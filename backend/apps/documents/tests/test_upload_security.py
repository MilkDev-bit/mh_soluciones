"""
Pruebas de seguridad de la subida de documentos:
- la tarea debe pertenecer al proyecto indicado;
- la carpeta destino de Drive debe estar dentro de la carpeta del proyecto;
- la navegación de carpetas no puede salir del proyecto.
"""
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.documents.models import Document
from apps.documents.services import GoogleDriveService, is_valid_drive_id
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task

User = get_user_model()
FOLDER_ID = 'folderAbc1234567890'


class UploadSecurityTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', password='x', role='ADMIN')
        self.student = User.objects.create_user(username='stu', password='x', role='STUDENT')
        self.mine = Project.objects.create(name='Mio', status='IN_PROGRESS', created_by=self.admin)
        self.other = Project.objects.create(name='Ajeno', status='IN_PROGRESS', created_by=self.admin)
        ProjectMember.objects.create(project=self.mine, user=self.student,
                                     role=ProjectMember.ProjectRole.MEMBER)
        self.other_task = Task.objects.create(title='Ajena', project=self.other, created_by=self.admin)
        self.client = APIClient()
        self.client.force_authenticate(self.student)

    def post(self, **extra):
        data = {
            'file': SimpleUploadedFile('a.txt', b'x', content_type='text/plain'),
            'project': self.mine.id,
            'folder_type': 'DOCUMENTOS',
        }
        data.update(extra)
        return self.client.post('/api/v1/documents/', data, format='multipart')

    def test_rechaza_tarea_de_otro_proyecto(self):
        # Antes: se validaba solo `project` y luego se tomaba task.project.
        response = self.post(task=self.other_task.id)
        self.assertEqual(response.status_code, 400)
        self.assertIn('task', response.data)
        self.assertFalse(Document.objects.exists())

    def test_rechaza_tarea_ajena_sin_proyecto(self):
        response = self.post(project='', task=self.other_task.id)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Document.objects.exists())

    @patch('apps.documents.api.views.GoogleDriveService')
    def test_rechaza_carpeta_fuera_del_proyecto(self, mock_drive):
        mock_drive.return_value.folder_belongs_to_project.return_value = False
        response = self.post(target_folder_id=FOLDER_ID)
        self.assertEqual(response.status_code, 400)
        self.assertIn('target_folder_id', response.data)
        self.assertFalse(Document.objects.exists())

    def test_rechaza_id_de_carpeta_malformado(self):
        response = self.post(target_folder_id="x' or name contains '")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Document.objects.exists())

    @patch('apps.documents.api.views.GoogleDriveService')
    def test_falla_cerrado_si_drive_no_responde(self, mock_drive):
        mock_drive.return_value.folder_belongs_to_project.side_effect = ConnectionError('sin red')
        response = self.post(target_folder_id=FOLDER_ID)
        self.assertEqual(response.status_code, 503)
        self.assertFalse(Document.objects.exists())

    @patch('apps.documents.api.views.GoogleDriveService')
    def test_listar_subcarpetas_fuera_del_proyecto_prohibido(self, mock_drive):
        mock_drive.return_value.folder_belongs_to_project.return_value = False
        response = self.client.get('/api/v1/documents/folders/', {
            'project': self.mine.id, 'parent_folder_id': FOLDER_ID,
        })
        self.assertEqual(response.status_code, 403)
        mock_drive.return_value.list_direct_subfolders.assert_not_called()


@override_settings(GOOGLE_DRIVE_ROOT_FOLDER_ID='rootFolder123456')
class FolderBelongsToProjectTests(TestCase):
    """Recorre los padres en Drive: RAÍZ / año / proyecto / ..."""

    def make_service(self, tree):
        svc = GoogleDriveService.__new__(GoogleDriveService)
        svc.service = MagicMock()

        def get(fileId, **_):
            req = MagicMock()
            req.execute.return_value = tree[fileId]
            return req

        svc.service.files.return_value.get.side_effect = get
        return svc

    def folder(self, fid, name, parent):
        return {'id': fid, 'name': name, 'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent], 'trashed': False}

    def setUp(self):
        self.project = MagicMock()
        self.project.name = 'Mio'
        self.tree = {
            'year2026folder00': self.folder('year2026folder00', '2026', 'rootFolder123456'),
            'projMioFolder000': self.folder('projMioFolder000', 'Mio', 'year2026folder00'),
            'subFotosFolder00': self.folder('subFotosFolder00', 'FOTOS', 'projMioFolder000'),
            'subDeepFolder000': self.folder('subDeepFolder000', 'Semana 3', 'subFotosFolder00'),
            'projAjenoFolder0': self.folder('projAjenoFolder0', 'Ajeno', 'year2026folder00'),
            'outsideFolder000': self.folder('outsideFolder000', 'Mio', 'someOtherRoot000'),
            'someOtherRoot000': {'id': 'someOtherRoot000', 'name': 'x',
                                 'mimeType': 'application/vnd.google-apps.folder', 'parents': []},
        }
        self.svc = self.make_service(self.tree)

    def test_carpeta_del_proyecto_y_subcarpetas(self):
        for fid in ('projMioFolder000', 'subFotosFolder00', 'subDeepFolder000'):
            self.assertTrue(self.svc.folder_belongs_to_project(fid, self.project), fid)

    def test_otro_proyecto_o_fuera_de_la_raiz(self):
        for fid in ('projAjenoFolder0', 'outsideFolder000', 'year2026folder00', 'rootFolder123456'):
            self.assertFalse(self.svc.folder_belongs_to_project(fid, self.project), fid)

    def test_archivo_o_papelera(self):
        self.tree['subFotosFolder00']['trashed'] = True
        self.assertFalse(self.svc.folder_belongs_to_project('subDeepFolder000', self.project))

    def test_id_invalido(self):
        self.assertFalse(is_valid_drive_id("abc' or '1'='1"))
        self.assertTrue(is_valid_drive_id('1AbC_d-efGhIjKlMn'))
