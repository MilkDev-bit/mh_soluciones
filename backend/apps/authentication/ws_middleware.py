from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.authentication.models import CustomUser
import http.cookies

@database_sync_to_async
def get_user_from_cookie(cookie_string):
    try:
        # Analizar el string de cookies
        cookie = http.cookies.SimpleCookie()
        cookie.load(cookie_string)
        
        if 'access_token' in cookie:
            access_token = cookie['access_token'].value
            untyped_token = UntypedToken(access_token)
            user_id = untyped_token.get('user_id')
            return CustomUser.objects.get(id=user_id)
    except (InvalidToken, TokenError, CustomUser.DoesNotExist, Exception):
        pass
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
