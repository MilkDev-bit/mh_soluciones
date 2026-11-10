"""Centro de Archivos: carpetas virtuales, filtros en servidor y ZIP."""
import io
import tempfile
import zipfile
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from apps.documents.models import Document
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()
MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA, DEFAULT_FILE_STORAGE='django.core.files.storage.FileSystemStorage')
class ExplorerTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        self.ana = User.objects.create_user(username='ana', email='ana@x.com', password='x', role='STUDENT',
                                            first_name='Ana', last_name='López')
        self.beto = User.objects.create_user(username='beto', email='b@x.com', password='x', role='STUDENT',
                                             first_name='Beto', last_name='Ruiz')
        self.p1 = Project.objects.create(name='Obra Norte', description='d', status='IN_PROGRESS',
                                         created_by=self.admin)
        self.p2 = Project.objects.create(name='Obra Sur', description='d', status='IN_PROGRESS',
                                         created_by=self.admin)
        for u in (self.ana, self.beto):
            ProjectMember.objects.create(project=self.p1, user=u)
        self.campanas = Task.objects.create(title='Campañas', project=self.p1, created_by=self.admin, status='OPEN')
        self.kpi = Task.objects.create(title='KPI', project=self.p1, created_by=self.admin, status='OPEN')
        sub_ana = TaskSubmission.objects.create(task=self.campanas, submitted_by=self.ana, notes='x')
        sub_beto = TaskSubmission.objects.create(task=self.campanas, submitted_by=self.beto, notes='x')

        self.d1 = self.doc('evidencia.pdf', b'PDF-ANA', self.ana, task=self.campanas, sub=sub_ana)
        self.d2 = self.doc('evidencia.pdf', b'PDF-ANA-2', self.ana, task=self.campanas, sub=sub_ana)
        self.d3 = self.doc('foto.jpg', b'JPG-BETO', self.beto, task=self.campanas, sub=sub_beto)
        self.d4 = self.doc('reporte.xlsx', b'XLSX', self.ana, task=self.kpi)
        self.d5 = self.doc('acta.pdf', b'ACTA', self.admin, drive_folder='Contratos')
        self.d6 = self.doc('plano.pdf', b'PLANO', self.admin, project=self.p2)
        old = timezone.now() - timedelta(days=40)
        Document.objects.filter(pk=self.d6.pk).update(created_at=old)

    def doc(self, name, content, user, task=None, sub=None, drive_folder='', project=None):
        return Document.objects.create(
            name=name, file=SimpleUploadedFile(name, content), file_size=len(content),
            uploaded_by=user, project=project or self.p1, task=task, task_submission=sub,
            drive_parent_folder_name=drive_folder, folder_type='DOCUMENTS', upload_status='COMPLETE',
        )

    def client_for(self, user):
        c = APIClient()
        c.force_authenticate(user)
        return c

    def test_niveles_de_carpetas(self):
        c = self.client_for(self.admin)
        r = c.get('/api/v1/documents/folder-summary/')
        self.assertEqual(r.data['level'], 'projects')
        counts = {i['name']: i['count'] for i in r.data['items']}
        self.assertEqual(counts, {'Obra Norte': 5, 'Obra Sur': 1})

        r = c.get(f'/api/v1/documents/folder-summary/?project={self.p1.pk}')
        self.assertEqual(r.data['level'], 'folders')
        counts = {i['name']: i['count'] for i in r.data['items']}
        self.assertEqual(counts, {'Campañas': 3, 'KPI': 1, 'Contratos': 1})

        r = c.get(f'/api/v1/documents/folder-summary/?project={self.p1.pk}&folder=Campañas')
        self.assertEqual(r.data['level'], 'people')
        counts = {i['name']: i['count'] for i in r.data['items']}
        self.assertEqual(counts, {'Ana López': 2, 'Beto Ruiz': 1})

    def test_filtros_en_servidor_con_paginacion(self):
        c = self.client_for(self.admin)
        r = c.get(f'/api/v1/documents/?project={self.p1.pk}&folder=Campañas&uploaded_by={self.ana.pk}&page_size=1')
        self.assertEqual(r.data['count'], 2)
        self.assertEqual(len(r.data['results']), 1)
        r = c.get('/api/v1/documents/?search=plano')
        self.assertEqual([d['name'] for d in r.data['results']], ['plano.pdf'])
        hoy = timezone.localdate().isoformat()
        r = c.get(f'/api/v1/documents/?date_from={hoy}')
        self.assertEqual(r.data['count'], 5)  # el plano tiene 40 días
        self.assertNotIn('allowed_ips', r.data['results'][0]['uploaded_by'])

    def test_zip_de_carpeta_con_estructura_y_nombres_repetidos(self):
        c = self.client_for(self.admin)
        r = c.get(f'/api/v1/documents/download-zip/?project={self.p1.pk}&folder=Campañas&zip_name=Campañas')
        self.assertEqual(r.status_code, 200)
        self.assertIn('Campañas.zip', r['Content-Disposition'])
        body = b''.join(r.streaming_content) if not r.is_async else b''.join(
            __import__('asgiref.sync', fromlist=['async_to_sync']).async_to_sync(self._collect)(r))
        zf = zipfile.ZipFile(io.BytesIO(body))
        names = sorted(zf.namelist())
        self.assertEqual(names, ['Ana López/evidencia (2).pdf', 'Ana López/evidencia.pdf', 'Beto Ruiz/foto.jpg'])
        self.assertEqual(zf.read('Beto Ruiz/foto.jpg'), b'JPG-BETO')

    async def _collect(self, response):
        return [chunk async for chunk in response.streaming_content]

    def test_zip_del_proyecto_completo_por_carpeta(self):
        c = self.client_for(self.admin)
        r = c.get(f'/api/v1/documents/download-zip/?project={self.p1.pk}')
        from asgiref.sync import async_to_sync
        body = b''.join(async_to_sync(self._collect)(r))
        names = set(zipfile.ZipFile(io.BytesIO(body)).namelist())
        self.assertIn('KPI/Ana López/reporte.xlsx', names)
        self.assertIn('Contratos/adm/acta.pdf', names)

    def test_zip_vacio_responde_mensaje(self):
        r = self.client_for(self.admin).get('/api/v1/documents/download-zip/?search=noexiste')
        self.assertEqual(r.status_code, 404)

    def test_alumno_no_ve_archivos_entregados_por_companeros(self):
        r = self.client_for(self.ana).get(f'/api/v1/documents/?project={self.p1.pk}&page_size=100')
        names = {d['name'] for d in r.data['results']}
        self.assertNotIn('foto.jpg', names)
        self.assertIn('evidencia.pdf', names)
        self.assertIn('acta.pdf', names)
        r = self.client_for(self.ana).get(f'/api/v1/documents/folder-summary/?project={self.p1.pk}&folder=Campañas')
        self.assertEqual([i['name'] for i in r.data['items']], ['Ana López'])
