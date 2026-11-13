"""La auditoría registra a quien hizo la acción (no al creador del objeto)."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.middleware import set_current_audit_user
from apps.core.models import RegistroActividad
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()


class AuditActorTests(TestCase):
    def setUp(self):
        self.creador = User.objects.create_user(username='soporte', email='s@x.com', password='x',
                                                role='SUPERADMIN', first_name='Milton', last_name='Piña')
        self.admin = User.objects.create_user(username='ana', email='a@x.com', password='x',
                                              role='SUPERADMIN', first_name='Ana', last_name='López')
        self.alumno = User.objects.create_user(username='cri', email='c@x.com', password='x', role='STUDENT',
                                               first_name='Jose', last_name='Diaz')
        set_current_audit_user(None)
        self.project = Project.objects.create(name='Axioma', description='d', status='IN_PROGRESS',
                                              created_by=self.creador)

    def client_for(self, user):
        client = APIClient()
        token = RefreshToken.for_user(user).access_token
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return client

    def test_edit_by_other_admin_is_attributed_to_them(self):
        ProjectMember.objects.create(project=self.project, user=self.admin, role='ADMIN')
        res = self.client_for(self.admin).patch(f'/api/v1/projects/{self.project.id}/', {'name': 'Axioma 2'},
                                                format='json')
        self.assertEqual(res.status_code, 200, res.data)
        log = RegistroActividad.objects.filter(accion='PROYECTO_ACTUALIZADO').latest('created_at')
        self.assertEqual(log.usuario, self.admin)
        self.assertEqual(log.descripcion, "Ana López editó el proyecto 'Axioma 2'.")

    def test_without_request_is_system_not_creator(self):
        # Sin request (Celery, comandos): "Sistema", ya no el creador del proyecto.
        self.project.name = 'Axioma 3'
        self.project.save()
        log = RegistroActividad.objects.filter(accion='PROYECTO_ACTUALIZADO').latest('created_at')
        self.assertIsNone(log.usuario)
        self.assertEqual(log.actor_username, 'Sistema')
        self.assertTrue(log.descripcion.startswith('Sistema editó'))

    def test_member_added_and_submission_are_logged(self):
        set_current_audit_user(self.admin)
        ProjectMember.objects.create(project=self.project, user=self.alumno)
        set_current_audit_user(None)
        task = Task.objects.create(title='KPI', project=self.project, created_by=self.creador)
        TaskSubmission.objects.create(task=task, submitted_by=self.alumno, notes='ok')

        miembro = RegistroActividad.objects.get(accion='MIEMBRO_AGREGADO')
        self.assertEqual(miembro.usuario, self.admin)
        entrega = RegistroActividad.objects.get(accion='ENTREGA_REALIZADA')
        self.assertEqual(entrega.usuario, self.alumno)
        self.assertIn("Jose Diaz entregó la tarea 'KPI'", entrega.descripcion)
