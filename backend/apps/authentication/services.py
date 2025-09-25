from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode


def send_welcome_email(user, raw_password):
    """
    Envía un correo de bienvenida a un nuevo usuario con sus credenciales.

    Args:
        user (CustomUser): La instancia del nuevo usuario.
        raw_password (str): La contraseña temporal en texto plano.
    """
    if not user.email:
        return

    login_url = settings.FRONTEND_URL + '/login'

    context = {
    'user': user,
    'password': raw_password,
    'login_url': login_url,
    }


    html_message = render_to_string('authentication/emails/welcome_email.html', context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject='¡Bienvenido a MH Soluciones Empresariales!',
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )


def send_password_reset_email(user):
    """
    Envía un correo para restablecer la contraseña.

    Args:
        user (CustomUser): La instancia del usuario que solicita el reseteo.
    """
    if not user.email:
        return

    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))

    reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

    context = {
        'user': user,
        'reset_url': reset_url,
    }

    html_message = render_to_string('authentication/emails/password_reset_email.html', context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject='Restablecimiento de Contraseña para tu Cuenta',
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )