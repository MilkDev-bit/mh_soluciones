import threading
from django.utils import timezone
from datetime import timedelta

_audit_thread_locals = threading.local()


def get_current_audit_user():
    """Devuelve el usuario autenticado del request actual (para signals de auditoría)."""
    return getattr(_audit_thread_locals, 'user', None)


class AuditUserMiddleware:
    """
    Middleware que almacena el usuario del request en thread-local
    para que los signals puedan identificar al actor de cada acción.
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