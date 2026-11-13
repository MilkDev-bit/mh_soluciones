"""
Cierre de sesión por 40 min de inactividad y ausencia de caducidad de contraseña.
"""
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.constants import SESSION_INACTIVITY_MINUTES

User = get_user_model()


class SessionInactivityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', password='StrongP@ssw0rd123', role='ADMIN')
        self.client = APIClient()
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']] = str(refresh.access_token)
        self.client.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']] = str(refresh)

    def set_last_activity(self, minutes_ago):
        User.objects.filter(pk=self.user.pk).update(
            last_activity=timezone.now() - timedelta(minutes=minutes_ago))

    def test_limite_es_40_minutos(self):
        self.assertEqual(SESSION_INACTIVITY_MINUTES, 40)

    def test_activo_puede_usar_la_api_y_se_registra_actividad(self):
        self.set_last_activity(30)
        response = self.client.get('/api/v1/auth/profile/')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertLess(timezone.now() - self.user.last_activity, timedelta(seconds=10))

    def test_inactivo_mas_de_40_min_rechazado(self):
        self.set_last_activity(41)
        self.assertEqual(self.client.get('/api/v1/auth/profile/').status_code, 401)

    def test_refresh_rechazado_por_inactividad_y_borra_cookies(self):
        self.set_last_activity(41)
        response = self.client.post('/api/v1/auth/token/refresh/')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['code'], 'session_inactive')
        self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']].value, '')

    def test_refresh_permitido_si_hay_actividad_reciente(self):
        self.set_last_activity(10)
        self.assertEqual(self.client.post('/api/v1/auth/token/refresh/').status_code, 200)

    def test_ping_mantiene_la_sesion(self):
        self.set_last_activity(5)
        response = self.client.post('/api/v1/auth/session/ping/')
        self.assertEqual(response.status_code, 204)
        self.user.refresh_from_db()
        self.assertLess(timezone.now() - self.user.last_activity, timedelta(seconds=10))

    def test_logout_funciona_aunque_la_sesion_haya_vencido(self):
        self.set_last_activity(60)
        self.assertEqual(self.client.post('/api/v1/auth/logout/').status_code, 200)

    def test_sin_registro_de_actividad_no_se_bloquea(self):
        User.objects.filter(pk=self.user.pk).update(last_activity=None)
        self.assertEqual(self.client.get('/api/v1/auth/profile/').status_code, 200)


class NoPasswordExpiryTests(TestCase):
    def test_contrasena_antigua_puede_iniciar_sesion(self):
        user = User.objects.create_user(username='viejo', password='StrongP@ssw0rd123')
        User.objects.filter(pk=user.pk).update(password_changed_at=timezone.now() - timedelta(days=400))
        response = APIClient().post('/api/v1/auth/login/',
                                    {'username': 'viejo', 'password': 'StrongP@ssw0rd123'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('requires_password_change', response.data)
