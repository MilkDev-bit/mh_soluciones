from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from urllib.parse import parse_qs
from django.conf import settings

User = get_user_model()

@database_sync_to_async
def get_user(token_key):
    try:
        token = AccessToken(token_key)
        user_id = token.payload.get('user_id')
        return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        return AnonymousUser()

class JWTAuthMiddleware:
    """
    Middleware de autenticación por Token JWT para Django Channels.
    Soporta tokens en query string y en cookies HttpOnly.
    Rechaza conexiones anónimas de forma inmediata para mayor seguridad.
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # 1. Intentar obtener el token de query params (fallback)
        query_string = scope.get('query_string', b'').decode('utf-8')
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]

        # 2. Intentar obtener el token de las cookies (preferido para el nuevo sistema HttpOnly)
        if not token:
            from http.cookies import SimpleCookie
            headers = dict(scope.get('headers', []))
            if b'cookie' in headers:
                cookie = SimpleCookie(headers[b'cookie'].decode('utf-8'))
                auth_cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
                if auth_cookie_name in cookie:
                    token = cookie[auth_cookie_name].value

        if token:
            scope['user'] = await get_user(token)
        else:
            scope['user'] = AnonymousUser()
        
        # Seguridad: Cerrar conexión rápidamente para usuarios no autenticados
        if scope['user'].is_anonymous:
            # Enviamos un mensaje de cierre al cliente de inmediato
            await send({"type": "websocket.close", "code": 4001})
            return

        return await self.app(scope, receive, send)