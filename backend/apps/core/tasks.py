"""Tareas de Celery generales."""
from celery import shared_task


@shared_task(name='send_rendered_email', bind=True, max_retries=3, default_retry_delay=60)
def send_rendered_email(self, subject, message, recipient_list, html_message=None):
    """Envía un correo ya renderizado; reintenta si el servidor SMTP falla."""
    from utils.email_notifications import deliver_email
    if not deliver_email(subject, message, recipient_list, html_message):
        raise self.retry()
    return len(recipient_list)
