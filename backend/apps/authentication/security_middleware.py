"""
Middleware de seguridad para rastreo de actividad y timeout de sesión.
"""
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin
from datetime import timedelta
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
import logging
from .constants import SESSION_INACTIVITY_MINUTES

logger = logging.getLogger(__name__)


class SessionSecurityMiddleware(MiddlewareMixin):
    """
    Middleware que rastrea la actividad del usuario y fuerza logout por inactividad.
    Tiempo de inactividad permitido: configurado en constants.py
    """
    
    INACTIVITY_TIMEOUT = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
    
    def process_request(self, request):
        # Exempt OAuth callback from session security checks
        if request.path.startswith('/api/v1/auth/google/callback'):
            logger.info("🔓 OAuth callback - bypassing session security middleware")
            return None
        
        # Solo procesar para usuarios autenticados con JWT
        if not request.path.startswith('/api/'):
            return None
        
        # Excluir endpoints públicos
        public_endpoints = ['/api/v1/auth/login/', '/api/v1/auth/login/verify/', '/api/v1/token/refresh/']
        if any(request.path.startswith(endpoint) for endpoint in public_endpoints):
            return None
        
        # Intentar autenticar con JWT
        jwt_auth = JWTAuthentication()
        try:
            user_auth = jwt_auth.authenticate(request)
            if user_auth is not None:
                user, _ = user_auth
                
                # Verificar inactividad
                if user.last_activity:
                    time_since_activity = timezone.now() - user.last_activity
                    
                    if time_since_activity > self.INACTIVITY_TIMEOUT:
                        # Sesión expirada por inactividad
                        raise AuthenticationFailed('Sesión expirada por inactividad.')
                
                # Actualizar última actividad
                user.last_activity = timezone.now()
                user.save(update_fields=['last_activity'])
                
        except AuthenticationFailed:
            # Re-raise authentication failures
            raise
        except Exception as e:
            # Log otros errores pero permitir que el request continúe
            logger.warning(f"Error in SessionSecurityMiddleware: {e}")
        
        return None


class PasswordExpiryMiddleware(MiddlewareMixin):
    """
    Middleware que verifica si la contraseña del usuario ha expirado.
    """
    
    def process_request(self, request):
        # Exempt OAuth callback from password expiry checks  
        if request.path.startswith('/api/v1/auth/google/callback'):
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
