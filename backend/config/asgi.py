import os
from django.core.asgi import get_asgi_application

# Establecer el módulo de configuración antes de cualquier otra cosa
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Inicializar la aplicación ASGI de Django (esto carga los modelos y la configuración)
django_asgi_app = get_asgi_application()

# IMPORTANTE: Estos imports deben ir DESPUÉS de get_asgi_application()
# porque dependen de que la AppRegistry de Django esté lista.
from channels.routing import ProtocolTypeRouter, URLRouter
from apps.authentication.ws_middleware import (
    JWTAuthCookieMiddleware, SameOriginOrAllowedValidator, websocket_allowed_origins,
)
from apps.notifications.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    # [FIX seguridad] Validación de Origin: solo el propio sitio (frontend vía
    # nginx o backend) y los orígenes configurados pueden abrir el WebSocket.
    # Sin esto, cualquier página podía abrirlo desde el navegador de un
    # usuario y la cookie lo autenticaba (CSWSH).
    "websocket": SameOriginOrAllowedValidator(
        JWTAuthCookieMiddleware(
            URLRouter(
                websocket_urlpatterns
            )
        ),
        websocket_allowed_origins(),
    ),
})