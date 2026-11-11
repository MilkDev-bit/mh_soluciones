"""El panel de usuarios es solo del SUPERADMIN; el directorio mínimo, de quien elige personas."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class UserListAccessTests(TestCase):
    def setUp(self):
        mk = lambda u, role, **kw: User.objects.create_user(username=u, email=f'{u}@x.com', password='x',
                                                             role=role, **kw)
        self.users = {r: mk(r.lower(), r) for r in
                      ('SUPERADMIN', 'ADMIN', 'CEO', 'RH', 'DIRECTOR', 'PROFESSOR', 'STUDENT', 'CLIENT')}
        mk('baja', 'STUDENT', is_active=False)
        self.client = APIClient()

    def as_(self, role):
        self.client.force_authenticate(self.users[role])
        return self.client

    def test_users_panel_only_superadmin(self):
        target = self.users['STUDENT'].id
        for role in self.users:
            c = self.as_(role)
            expected = 200 if role == 'SUPERADMIN' else 403
            self.assertEqual(c.get('/api/v1/auth/users/').status_code, expected, role)
            self.assertEqual(c.get(f'/api/v1/auth/users/{target}/').status_code, expected, role)
            self.assertEqual(c.get('/api/v1/auth/users/stats/').status_code, expected, role)

    def test_directory_roles_and_fields(self):
        for role in ('STUDENT', 'PROFESSOR', 'DIRECTOR', 'CLIENT'):
            self.assertEqual(self.as_(role).get('/api/v1/auth/directory/').status_code, 403, role)

        res = self.as_('ADMIN').get('/api/v1/auth/directory/')
        self.assertEqual(res.status_code, 200)
        first = res.data['results'][0]
        self.assertNotIn('email', first)
        self.assertNotIn('allowed_ips', first)
        self.assertNotIn('baja', [u['username'] for u in res.data['results']])

        res = self.as_('RH').get('/api/v1/auth/directory/', {'include_inactive': 1})
        self.assertIn('baja', [u['username'] for u in res.data['results']])
        self.assertIn('email', res.data['results'][0])

    def test_clients_list_only_management(self):
        self.assertEqual(self.as_('STUDENT').get('/api/v1/auth/clients/').data['count']
                         if isinstance(self.as_('STUDENT').get('/api/v1/auth/clients/').data, dict)
                         else len(self.as_('STUDENT').get('/api/v1/auth/clients/').data), 0)
        data = self.as_('DIRECTOR').get('/api/v1/auth/clients/').data
        n = data['count'] if isinstance(data, dict) else len(data)
        self.assertEqual(n, 1)
