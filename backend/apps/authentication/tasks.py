from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model

from .services import send_welcome_email, send_password_reset_email

User = get_user_model()


@shared_task(name="send_welcome_email_task")
def async_send_welcome_email(user_id, raw_password):
    """
    Tarea de Celery para enviar el correo de bienvenida de forma asíncrona.
    
    Recibe el ID del usuario en lugar del objeto completo, ya que es una
    mejor práctica para las tareas de Celery.
    """
    try:
        user = User.objects.get(pk=user_id)
        send_welcome_email(user, raw_password)
        return f"Correo de bienvenida enviado a {user.email}"
    except User.DoesNotExist:
        return f"Error: Usuario con id {user_id} no encontrado."


@shared_task(name="send_password_reset_email_task")
def async_send_password_reset_email(user_id):
    """
    Tarea de Celery para enviar el correo de reseteo de contraseña de forma asíncrona.
    """
    try:
        user = User.objects.get(pk=user_id)
        send_password_reset_email(user)
        return f"Correo de reseteo de contraseña enviado a {user.email}"
    except User.DoesNotExist:
        return f"Error: Usuario con id {user_id} no encontrado."


@shared_task(name="deactivate_inactive_users_task")
def deactivate_inactive_users():
    """
    Tarea periódica (a configurar en Celery Beat) para desactivar usuarios
    que no han iniciado sesión en un tiempo determinado (ej. 90 días).
    """
    inactive_threshold = timezone.now() - timedelta(days=90)
    
    inactive_users = User.objects.filter(
        last_login__lt=inactive_threshold,
        is_active=True
    )
    
    count = inactive_users.count()
    if count > 0:
        inactive_users.update(is_active=False)
    
    return f"{count} usuarios inactivos han sido desactivados."