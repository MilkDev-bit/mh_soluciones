"""
Registro de actividad (auditoría) compartido por los signals de proyectos y tareas.

El actor es el usuario autenticado del request (get_current_audit_user). Si no
hay request (tareas programadas de Celery, comandos), la acción se registra como
"Sistema" en lugar de atribuirla al creador del objeto, que era lo que hacía
que todo pareciera hecho por la misma persona.
"""
import logging

from apps.core.middleware import get_current_audit_user

logger = logging.getLogger(__name__)

SISTEMA = 'Sistema'


def current_actor():
    user = get_current_audit_user()
    return user if (user is not None and getattr(user, 'is_authenticated', False)) else None


def actor_label(actor):
    """Nombre para la descripción: nombre completo, o el usuario si no tiene."""
    if actor is None:
        return SISTEMA
    return (actor.get_full_name() or '').strip() or actor.username


def log_activity(accion, descripcion, actor, tarea_id=None, proyecto_id=None, metadata=None):
    """Registra la actividad sin interrumpir el flujo principal si algo falla."""
    try:
        from apps.core.models import RegistroActividad
        RegistroActividad.objects.create(
            usuario=actor,
            actor_username=actor.username if actor else SISTEMA,
            accion=accion,
            descripcion=descripcion,
            tarea_id=tarea_id,
            proyecto_id=proyecto_id,
            metadata=metadata or {},
        )
    except Exception as exc:  # pragma: no cover - la auditoría nunca debe romper la acción
        logger.error("Error al registrar actividad de auditoría [%s]: %s", accion, exc)
