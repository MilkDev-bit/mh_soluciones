import http.cookies
import logging
from urllib.parse import urlparse

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from channels.security.websocket import OriginValidator, WebsocketDenier
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from apps.authentication.models import CustomUser

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_cookie(cookie_string):
    """
    Usuario del WebSocket a partir de la cookie HttpOnly 'access_token'.

    [FIX seguridad]
    - Se valida como AccessToken (antes UntypedToken aceptaba también un
      refresh token, que dura mucho más).
    - Un usuario desactivado ya no puede conectarse aunque su token siga vigente.
    """
    try:
        cookie = http.cookies.SimpleCookie()
        cookie.load(cookie_string)
        cookie_name = settings.SIMPLE_JWT.get('AUTH_COOKIE', 'access_token')
        if cookie_name in cookie:
            token = AccessToken(cookie[cookie_name].value)
            user = CustomUser.objects.get(id=token.get('user_id'))
            if user.is_active:
                return user
    except (InvalidToken, TokenError, CustomUser.DoesNotExist, KeyError, ValueError):
        pass
    except Exception as exc:  # cookie mal formada u otro error: conexión anónima
        logger.warning("No se pudo autenticar el WebSocket: %s", exc)
    return AnonymousUser()


class JWTAuthCookieMiddleware(BaseMiddleware):
    """
    Middleware personalizado para autenticar WebSockets usando la cookie HttpOnly 'access_token'.
    """
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get('headers', []))
        if b'cookie' in headers:
            cookie_string = headers[b'cookie'].decode('utf-8')
            scope['user'] = await get_user_from_cookie(cookie_string)
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)


def websocket_allowed_origins():
    """
    Orígenes que pueden abrir el WebSocket (contra Cross-Site WebSocket
    Hijacking): el navegador manda la cookie de sesión a cualquier sitio que
    abra el socket, así que solo se aceptan el frontend y el propio backend
    (los mismos orígenes de CORS y CSRF, y los hosts de ALLOWED_HOSTS).
    """
    if settings.DEBUG:
        return ['*']
    origins = set()
    for origin in list(getattr(settings, 'CORS_ALLOWED_ORIGINS', [])) + list(getattr(settings, 'CSRF_TRUSTED_ORIGINS', [])):
        parsed = urlparse(origin)
        if parsed.scheme and parsed.netloc:
            origins.add(f'{parsed.scheme}://{parsed.netloc}')
    for host in getattr(settings, 'ALLOWED_HOSTS', []):
        # Solo hosts concretos: ni '*', ni rangos de IP (10.0.0.0/8), ni
        # comodines como '.up.railway.app' (cualquiera puede publicar ahí).
        if host and host != '*' and '/' not in host and not host.startswith('.'):
            origins.add(f'https://{host}')
    return sorted(origins)


class SameOriginOrAllowedValidator(OriginValidator):
    """
    Acepta el WebSocket si el Origin es el mismo sitio que atiende la petición
    (Origin == Host; es el caso del frontend, cuyo nginx reenvía /ws/ con su
    propio Host) o si está en la lista de orígenes permitidos. Un sitio ajeno
    manda su propio Origin, distinto del Host, y se rechaza.
    """

    async def __call__(self, scope, receive, send):
        if scope["type"] != "websocket":
            raise ValueError("SameOriginOrAllowedValidator solo aplica a WebSockets")
        origin = host = None
        for name, value in scope.get('headers', []):
            if name == b'origin':
                origin = urlparse(value.decode('latin1'))
            elif name == b'host':
                host = value.decode('latin1').strip().lower()
        if self.same_origin(origin, host) or self.valid_origin(origin):
            return await self.application(scope, receive, send)
        return await WebsocketDenier()(scope, receive, send)

    @staticmethod
    def same_origin(origin, host):
        return bool(
            origin is not None and host
            and origin.scheme in ('https', 'http')
            and (origin.netloc or '').lower() == host
        )
