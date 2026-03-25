import os
from django.core.asgi import get_asgi_application

# Establecer el módulo de configuración antes de cualquier otra cosa
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Inicializar la aplicación ASGI de Django (esto carga los modelos y la configuración)
django_asgi_app = get_asgi_application()

# IMPORTANTE: Estos imports deben ir DESPUÉS de get_asgi_application()
# porque dependen de que la AppRegistry de Django esté lista.
from channels.routing import ProtocolTypeRouter, URLRouter
from apps.authentication.ws_middleware import JWTAuthCookieMiddleware
from apps.notifications.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthCookieMiddleware(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})