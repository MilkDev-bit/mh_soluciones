import threading
from django.utils import timezone
from datetime import timedelta

_audit_thread_locals = threading.local()


def get_current_audit_user():
    """Devuelve el usuario autenticado del request actual (para signals de auditoría)."""
    return getattr(_audit_thread_locals, 'user', None)


def set_current_audit_user(user):
    """
    Fija el actor del request actual. La API autentica con JWT dentro de DRF,
    DESPUÉS de los middlewares, así que AuditUserMiddleware solo ve al usuario
    cuando hay sesión de Django (p. ej. quien entró al admin). La autenticación
    JWT llama a esta función para que los signals de auditoría sepan quién hizo
    cada acción.
    """
    _audit_thread_locals.user = user


class AuditUserMiddleware:
    """
    Middleware que almacena el usuario del request en thread-local
    para que los signals puedan identificar al actor de cada acción.
    Con JWT el usuario lo fija CookieJWTAuthentication (ver
    set_current_audit_user); aquí se limpia al terminar cada request.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if hasattr(request, 'user') and request.user.is_authenticated:
            _audit_thread_locals.user = request.user
        else:
            _audit_thread_locals.user = None
        response = self.get_response(request)
        _audit_thread_locals.user = None
        return response


class ActivityTrackingMiddleware:
    """
    Middleware para actualizar el campo 'last_activity' de un usuario.
    
    Esto nos permite saber cuándo fue la última vez que un usuario autenticado
    hizo una petición al servidor, lo que es útil para saber si está "en línea".
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        
        response = self.get_response(request)
        
        if hasattr(request, 'user') and request.user.is_authenticated:
            one_minute_ago = timezone.now() - timedelta(minutes=1)
            
            if not request.user.last_activity or request.user.last_activity < one_minute_ago:
                request.user.last_activity = timezone.now()
                request.user.save(update_fields=['last_activity'])
                
        return response