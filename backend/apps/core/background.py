"""
Trabajo en segundo plano: Celery si hay un worker activo, si no un hilo.

En Railway el worker de Celery corre como un servicio aparte ("Celery").
Si no está arriba (o Redis no responde), la app sigue funcionando con hilos
del propio servidor web, como antes.
"""
import logging
import os
import threading
import time

logger = logging.getLogger(__name__)

_CHECK = {'value': None, 'checked_at': 0.0}
_CHECK_TTL = 60  # segundos


def is_worker_process():
    """True dentro del servicio de Celery (lo marca entrypoint.sh)."""
    return os.environ.get('CELERY_WORKER_PROCESS') == '1'


def celery_worker_available():
    """
    ¿Hay al menos un worker de Celery respondiendo? Se consulta a Redis como
    mucho una vez por minuto por proceso (cada consulta puede tardar 0.5 s).
    """
    now = time.monotonic()
    if _CHECK['value'] is not None and now - _CHECK['checked_at'] < _CHECK_TTL:
        return _CHECK['value']
    try:
        from config.celery import app as celery_app
        available = bool(celery_app.control.inspect(timeout=0.5).ping())
    except Exception:
        available = False
    _CHECK.update(value=available, checked_at=now)
    return available


def run_in_thread(func, *args, **kwargs):
    """Ejecuta `func` en un hilo y cierra su conexión a la BD al terminar."""
    def _target():
        from django.db import close_old_connections
        try:
            func(*args, **kwargs)
        except Exception:
            logger.exception('Error en tarea de fondo %s', getattr(func, '__name__', func))
        finally:
            close_old_connections()

    # No-daemon: al reciclar el proceso, Python espera a que termine.
    thread = threading.Thread(target=_target, daemon=False)
    thread.start()
    return thread
