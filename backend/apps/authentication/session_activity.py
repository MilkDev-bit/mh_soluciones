"""
Cierre de sesión por inactividad (SESSION_INACTIVITY_MINUTES, 40 min).

El frontend cierra la sesión si nadie toca la app en ninguna pestaña durante
ese tiempo. Este módulo cubre lo que el frontend no ve: si se cierra el
navegador o la pestaña, las cookies siguen vivas (el refresh dura 24 h) y al
volver la sesión seguía abierta. Ahora, si el servidor no recibió ninguna
petición del usuario en 40 min, el access token deja de aceptarse y el
refresh se rechaza, así que hay que iniciar sesión de nuevo.

`last_activity` se actualiza con cualquier petición autenticada (como mucho
una vez por minuto para no escribir en cada request). Mientras la app está
abierta, el frontend manda además un "ping" cada pocos minutos si el usuario
está activo, para que leer una página larga sin hacer peticiones no cuente
como inactividad.
"""
from datetime import timedelta

from django.utils import timezone

from .constants import SESSION_INACTIVITY_MINUTES

INACTIVITY_TIMEOUT = timedelta(minutes=SESSION_INACTIVITY_MINUTES)
WRITE_INTERVAL = timedelta(seconds=60)


def is_inactive(user, now=None):
    """True si el usuario lleva más del límite sin peticiones al servidor."""
    last = getattr(user, 'last_activity', None)
    if not last:
        return False
    return (now or timezone.now()) - last > INACTIVITY_TIMEOUT


def touch(user, now=None):
    """Registra actividad (como mucho una escritura por minuto)."""
    now = now or timezone.now()
    last = getattr(user, 'last_activity', None)
    if last and now - last < WRITE_INTERVAL:
        return
    type(user).objects.filter(pk=user.pk).update(last_activity=now)
    user.last_activity = now
