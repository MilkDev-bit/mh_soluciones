"""
Pruebas de: IP real del cliente, vencimiento de bloqueos automáticos de IP,
cifrado que falla cerrado y autenticación/origen de WebSockets.
"""
from datetime import timedelta
from unittest import mock

from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from apps.authentication.models import BlockedIP, EncryptedCharField
from apps.authentication.ws_middleware import get_user_from_cookie, websocket_allowed_origins
from apps.core.client_ip import AnonRateThrottle, get_client_ip

User = get_user_model()


@override_settings(CLIENT_IP_META_KEY='HTTP_X_REAL_IP')
class ClientIPTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()

    def test_ignora_x_forwarded_for_del_cliente(self):
        request = self.rf.get('/', HTTP_X_FORWARDED_FOR='6.6.6.6', HTTP_X_REAL_IP='8.8.4.4',
                              REMOTE_ADDR='100.64.0.2')
        self.assertEqual(get_client_ip(request), '8.8.4.4')

    def test_sin_encabezados_usa_remote_addr(self):
        request = self.rf.get('/', REMOTE_ADDR='1.0.0.1')
        self.assertEqual(get_client_ip(request), '1.0.0.1')

    def test_x_real_ip_interno_cae_a_x_forwarded_for(self):
        # nginx del frontend sin actualizar: X-Real-IP = IP interna del borde.
        request = self.rf.get('/', HTTP_X_REAL_IP='100.64.3.7',
                              HTTP_X_FORWARDED_FOR='8.8.8.8, 100.64.3.7', REMOTE_ADDR='10.1.2.3')
        self.assertEqual(get_client_ip(request), '8.8.8.8')

    def test_valor_invalido_no_se_usa(self):
        request = self.rf.get('/', HTTP_X_REAL_IP='<script>', REMOTE_ADDR='1.0.0.1')
        self.assertEqual(get_client_ip(request), '1.0.0.1')

    def test_throttle_no_se_salta_rotando_x_forwarded_for(self):
        throttle = AnonRateThrottle()
        a = self.rf.get('/', HTTP_X_FORWARDED_FOR='1.1.1.1', HTTP_X_REAL_IP='8.8.4.4')
        b = self.rf.get('/', HTTP_X_FORWARDED_FOR='2.2.2.2', HTTP_X_REAL_IP='8.8.4.4')
        self.assertEqual(throttle.get_ident(a), throttle.get_ident(b))


class BlockedIPExpiryTests(TestCase):
    def test_bloqueo_automatico_vence(self):
        BlockedIP.block_temporarily('9.9.9.9', 'Fuerza bruta', minutes=30)
        self.assertTrue(BlockedIP.is_blocked('9.9.9.9'))
        BlockedIP.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertFalse(BlockedIP.is_blocked('9.9.9.9'))

    def test_bloqueo_manual_es_permanente(self):
        BlockedIP.objects.create(ip_address='9.9.9.10', reason='manual')
        self.assertTrue(BlockedIP.is_blocked('9.9.9.10'))

    def test_reactiva_bloqueo_vencido(self):
        BlockedIP.objects.create(ip_address='9.9.9.11', reason='x', is_active=False)
        BlockedIP.block_temporarily('9.9.9.11', 'Fuerza bruta', minutes=30)
        self.assertTrue(BlockedIP.is_blocked('9.9.9.11'))

    @override_settings(CLIENT_IP_META_KEY='HTTP_X_REAL_IP')
    def test_login_bloqueado_por_ip_y_luego_libre(self):
        BlockedIP.block_temporarily('149.112.112.112', 'Fuerza bruta', minutes=30)
        response = self.client.post('/api/v1/auth/login/', {'username': 'a', 'password': 'b'},
                                    HTTP_X_REAL_IP='149.112.112.112', content_type='application/json')
        self.assertEqual(response.status_code, 403)
        # Otra IP (aunque falsifique X-Forwarded-For) no queda afectada.
        response = self.client.post('/api/v1/auth/login/', {'username': 'a', 'password': 'b'},
                                    HTTP_X_REAL_IP='149.112.112.9',
                                    HTTP_X_FORWARDED_FOR='149.112.112.112',
                                    content_type='application/json')
        self.assertNotEqual(response.status_code, 403)


class EncryptedFieldTests(TestCase):
    def test_falla_cerrado_si_no_puede_cifrar(self):
        field = EncryptedCharField()
        with mock.patch('apps.authentication.models.get_encryption_key', return_value=b'mala'):
            with self.assertRaises(ValueError):
                field.get_prep_value('secreto')

    def test_cifra_y_descifra(self):
        field = EncryptedCharField()
        stored = field.get_prep_value('secreto')
        self.assertNotEqual(stored, 'secreto')
        self.assertEqual(field.from_db_value(stored, None, None), 'secreto')


class WebSocketAuthTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='ws', password='x')

    def cookie(self, token):
        return f'access_token={token}'

    def test_access_token_valido(self):
        token = RefreshToken.for_user(self.user).access_token
        user = async_to_sync(get_user_from_cookie)(self.cookie(str(token)))
        self.assertEqual(user.pk, self.user.pk)

    def test_refresh_token_no_sirve_como_access(self):
        token = RefreshToken.for_user(self.user)
        user = async_to_sync(get_user_from_cookie)(self.cookie(str(token)))
        self.assertFalse(user.is_authenticated)

    def test_usuario_inactivo(self):
        token = RefreshToken.for_user(self.user).access_token
        self.user.is_active = False
        self.user.save()
        user = async_to_sync(get_user_from_cookie)(self.cookie(str(token)))
        self.assertFalse(user.is_authenticated)

    @override_settings(DEBUG=False, CORS_ALLOWED_ORIGINS=['https://app.example.com'],
                       CSRF_TRUSTED_ORIGINS=['https://api.example.com/'],
                       ALLOWED_HOSTS=['api.example.com', '.up.railway.app', '*', 'localhost'])
    def test_origenes_permitidos(self):
        origins = websocket_allowed_origins()
        self.assertIn('https://app.example.com', origins)
        self.assertIn('https://api.example.com', origins)
        self.assertNotIn('*', origins)
        self.assertFalse(any('railway' in o for o in origins))

    def test_handshake_desde_origen_ajeno_rechazado(self):
        from apps.authentication.ws_middleware import SameOriginOrAllowedValidator
        from channels.testing import WebsocketCommunicator
        from channels.generic.websocket import AsyncWebsocketConsumer

        class Echo(AsyncWebsocketConsumer):
            async def connect(self):
                await self.accept()

        app = SameOriginOrAllowedValidator(Echo.as_asgi(), ['https://app.example.com'])

        async def try_origin(origin, host=b'api.example.com'):
            comm = WebsocketCommunicator(app, '/ws/', headers=[(b'origin', origin), (b'host', host)])
            connected, _ = await comm.connect()
            await comm.disconnect()
            return connected

        self.assertTrue(async_to_sync(try_origin)(b'https://app.example.com'))
        self.assertFalse(async_to_sync(try_origin)(b'https://evil.example'))
        # Mismo sitio (frontend que reenvía /ws/ con su Host) aunque no esté en la lista.
        self.assertTrue(async_to_sync(try_origin)(b'https://front.up.railway.app', b'front.up.railway.app'))
        self.assertFalse(async_to_sync(try_origin)(b'https://evil.up.railway.app', b'front.up.railway.app'))
