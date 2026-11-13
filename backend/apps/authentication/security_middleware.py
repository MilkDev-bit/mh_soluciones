"""
Middleware de seguridad para rastreo de actividad y timeout de sesión.
"""
import logging
from datetime import timedelta
from django.http import HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from apps.core.client_ip import get_client_ip
from rest_framework_simplejwt.authentication import JWTAuthentication
from .constants import GOOGLE_OAUTH_CALLBACK_PATH, SESSION_INACTIVITY_MINUTES
from .models import BlockedIP

logger = logging.getLogger(__name__)


class SessionSecurityMiddleware(MiddlewareMixin):
    """
    Middleware que rastrea la actividad del usuario y fuerza logout por inactividad.
    Tiempo de inactividad permitido: configurado en constants.py
    """
    
    INACTIVITY_TIMEOUT = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
    ACTIVITY_WRITE_INTERVAL = timedelta(seconds=60)
    
    def process_request(self, request):
        # Exempt OAuth callback from session security checks
        if request.path.startswith(GOOGLE_OAUTH_CALLBACK_PATH):
            logger.info("🔓 OAuth callback - bypassing session security middleware")
            return None
        
        # Solo procesar para usuarios autenticados con JWT
        if not request.path.startswith('/api/'):
            return None
        
        # Excluir endpoints públicos (la ruta real del refresh es
        # /api/v1/auth/token/refresh/; antes se listaba /api/v1/token/refresh/).
        public_endpoints = [
            '/api/v1/auth/login/', '/api/v1/auth/login/verify/',
            '/api/v1/auth/token/refresh/', '/api/v1/auth/logout/',
        ]
        if any(request.path.startswith(endpoint) for endpoint in public_endpoints):
            return None

        # Nota: JWTAuthentication solo lee el encabezado Authorization; el
        # frontend usa cookies, así que este control solo aplica a clientes que
        # mandan el token en el encabezado.
        jwt_auth = JWTAuthentication()
        try:
            user_auth = jwt_auth.authenticate(request)
        except Exception:
            # Token inválido/expirado: que lo resuelva la vista con su 401 normal.
            return None
        if user_auth is None:
            return None

        user, _ = user_auth
        now = timezone.now()
        if user.last_activity and now - user.last_activity > self.INACTIVITY_TIMEOUT:
            # Antes se lanzaba AuthenticationFailed aquí; fuera de una vista de
            # DRF eso no se convierte en 401 y Django respondía 500.
            return JsonResponse(
                {'detail': 'Sesión expirada por inactividad.', 'code': 'session_inactive'},
                status=401,
            )

        # Guardar la actividad como mucho una vez por minuto (antes era un
        # UPDATE en la base de datos por cada petición).
        if not user.last_activity or now - user.last_activity > self.ACTIVITY_WRITE_INTERVAL:
            try:
                type(user).objects.filter(pk=user.pk).update(last_activity=now)
            except Exception as e:
                logger.warning(f"Error in SessionSecurityMiddleware: {e}")

        return None


class PasswordExpiryMiddleware(MiddlewareMixin):
    """
    Middleware que verifica si la contraseña del usuario ha expirado.
    """
    
    def process_request(self, request):
        # Exempt OAuth callback from password expiry checks  
        if request.path.startswith(GOOGLE_OAUTH_CALLBACK_PATH):
            logger.info("🔓 OAuth callback - bypassing password expiry middleware")
            return None
        
        # Solo procesar para usuarios autenticados
        if not hasattr(request, 'user') or not request.user.is_authenticated:
            return None
        
        # Excluir endpoint de cambio de contraseña
        if request.path in ['/api/v1/auth/profile/change-password/', '/api/v1/auth/logout/']:
            return None
        
        user = request.user
        
        # Verificar si se requiere cambio de contraseña forzado
        if user.force_password_change:
            from django.http import JsonResponse
            return JsonResponse({
                'error': 'Debe cambiar su contraseña antes de continuar.',
                'requires_password_change': True
            }, status=403)
        
        # Verificar si la contraseña ha expirado
        if user.is_password_expired():
            from django.http import JsonResponse
            return JsonResponse({
                'error': 'Su contraseña ha expirado. Debe cambiarla para continuar.',
                'requires_password_change': True,
                'password_expired': True
            }, status=403)
        
        return None

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