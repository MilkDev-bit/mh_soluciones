"""
Middleware de seguridad (bloqueo de IPs).
"""
import logging
from django.http import HttpResponseForbidden
from apps.core.client_ip import get_client_ip
from .models import BlockedIP

logger = logging.getLogger(__name__)


# SessionSecurityMiddleware y PasswordExpiryMiddleware se eliminaron:
# - La inactividad se controla en CookieJWTAuthentication y en el refresh
#   (ver session_activity.py); el middleware solo leía el encabezado
#   Authorization y nunca aplicaba con la sesión por cookies.
# - No hay caducidad de contraseña, y el middleware nunca veía al usuario
#   (request.user es anónimo antes de que DRF autentique el JWT).


class IPBlockerMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        client_ip = get_client_ip(request)
        
        if client_ip:
            # Verificar si la IP está en la base de datos y el bloqueo está activo
            is_blocked = BlockedIP.is_blocked(client_ip)
            if is_blocked:
                return HttpResponseForbidden("Tu dirección IP ha sido bloqueada por actividad sospechosa.")

        response = self.get_response(request)
        return response