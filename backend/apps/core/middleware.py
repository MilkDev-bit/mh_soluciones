from django.utils import timezone
from datetime import timedelta

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