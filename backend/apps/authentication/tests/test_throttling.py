"""Límites de peticiones: el refresh del token no comparte cupo con el login."""
from django.contrib.auth import get_user_model
from django.core.cache import cache
from unittest import mock

from django.test import TestCase
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class ThrottlingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username='ana', email='a@x.com', password='Prueba123!', role='ADMIN')

    def refresh(self, client):
        client.cookies['refresh_token'] = str(RefreshToken.for_user(self.user))
        return client.post('/api/v1/auth/token/refresh/', {}, format='json').status_code

    def test_refresh_is_not_limited_by_the_anonymous_rate(self):
        # Antes el refresh caía en 'anon' (10/min por IP, compartido con el
        # login): respondía 429 y el frontend cerraba la sesión.
        rates = {'anon': '2/min', 'user': '600/min', 'login': '2/min', 'token_refresh': '120/min'}
        with mock.patch.object(SimpleRateThrottle, 'THROTTLE_RATES', rates):
            client = APIClient()
            codes = [self.refresh(client) for _ in range(10)]
        self.assertNotIn(429, codes)

    def test_refresh_has_its_own_limit(self):
        rates = {'anon': '600/min', 'user': '600/min', 'login': '600/min', 'token_refresh': '3/min'}
        with mock.patch.object(SimpleRateThrottle, 'THROTTLE_RATES', rates):
            client = APIClient()
            codes = [self.refresh(client) for _ in range(4)]
        self.assertEqual(codes[:3], [200, 200, 200])
        self.assertEqual(codes[3], 429)

    def test_refresh_and_login_have_their_own_scopes(self):
        from apps.authentication.api.views import CookieTokenRefreshView, LoginAPIView
        self.assertEqual(CookieTokenRefreshView.throttle_scope, 'token_refresh')
        self.assertEqual(LoginAPIView.throttle_scope, 'login')

    def test_authenticated_burst_is_not_throttled(self):
        # Borrar o duplicar varias tareas seguidas dispara muchas peticiones.
        client = APIClient()
        client.force_authenticate(self.user)
        codes = {client.get('/api/v1/auth/profile/').status_code for _ in range(150)}
        self.assertNotIn(429, codes)
