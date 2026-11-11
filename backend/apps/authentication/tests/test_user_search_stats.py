"""Gestión de Usuarios: búsqueda sin acentos y totales globales."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class UserSearchStatsTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='root', email='r@x.com', password='x', role='SUPERADMIN')
        User.objects.create_user(username='AdanR_HQtos', email='adan@x.com', password='x', role='STUDENT',
                                 first_name='Adán Rodolfo', last_name='Hidalgo Quintos')
        User.objects.create_user(username='Adrian_Lecona', email='adrian@x.com', password='x', role='STUDENT',
                                 first_name='Adrian', last_name='Torres Lecona')
        User.objects.create_user(username='baja', email='baja@x.com', password='x', role='STUDENT',
                                 first_name='Inés', last_name='Muñoz', is_active=False)
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def usernames(self, q):
        res = self.client.get('/api/v1/auth/users/', {'search': q})
        self.assertEqual(res.status_code, 200)
        return sorted(u['username'] for u in res.data['results'])

    def test_accent_insensitive_and_multiword(self):
        self.assertEqual(self.usernames('adan'), ['AdanR_HQtos'])
        self.assertEqual(self.usernames('torres adrián'), ['Adrian_Lecona'])
        self.assertEqual(self.usernames('munoz'), ['baja'])
        self.assertEqual(self.usernames('lecona'), ['Adrian_Lecona'])

    def test_stats_count_all_users(self):
        res = self.client.get('/api/v1/auth/users/stats/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data, {'total': 4, 'active': 3, 'inactive': 1})
