from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class CustomUser(AbstractUser):
    """
    Modelo de Usuario personalizado que extiende el usuario base de Django.
    """
    class Role(models.TextChoices):
        SUPERADMIN = 'SUPERADMIN', _('Super Administrador')
        ADMIN = 'ADMIN', _('Administrador')
        DIRECTOR = 'DIRECTOR', _('Director')
        PROFESSOR = 'PROFESSOR', _('Profesor')
        STUDENT = 'STUDENT', _('Alumno / Empleado')
        CLIENT = 'CLIENT', _('Cliente')
        CEO = 'CEO', _('CEO')
        RH = 'RH', _('Recursos Humanos')

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.STUDENT,
        verbose_name=_('Rol de Usuario')
    )
    profile_picture = models.ImageField(
        upload_to='profile_pics/',
        null=True,
        blank=True,
        verbose_name=_('Foto de Perfil')
    )
    allowed_ips = models.TextField(
        blank=True,
        help_text=_("IPs permitidas separadas por comas. Dejar en blanco para permitir todas."),
        verbose_name=_('IPs Permitidas')
    )
    requires_2fa = models.BooleanField(
        default=False,
        verbose_name=_('Requiere 2FA')
    )

    last_login_ip = models.GenericIPAddressField(
        null=True, 
        blank=True, 
        verbose_name=_("Última IP de Sesión")
    )
    last_activity = models.DateTimeField(
        null=True, 
        blank=True, 
        verbose_name=_("Última Actividad")
    )


class LoginActivity(models.Model):
    """
    Modelo para registrar cada intento de inicio de sesión en el sistema.
    """
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='login_activities',
        verbose_name=_('Usuario')
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        verbose_name=_('Fecha y Hora')
    )
    ip_address = models.GenericIPAddressField(
        verbose_name=_('Dirección IP')
    )
    successful = models.BooleanField(
        verbose_name=_('Exitoso')
    )
    user_agent = models.CharField(
        max_length=255,
        blank=True,
        verbose_name=_('Agente de Usuario')
    )

    class Meta:
        verbose_name = _('Registro de Inicio de Sesión')
        verbose_name_plural = _('Registros de Inicio de Sesión')
        ordering = ['-timestamp']

    def __str__(self):
        status = "Exitoso" if self.successful else "Fallido"
        return f"Intento de login para {self.user.username} desde {self.ip_address} - {status}"
    

class GoogleApiCredentials(models.Model):
    """
    Almacena de forma segura los tokens de OAuth2 para un usuario específico.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='google_credentials'
    )
    access_token = models.CharField(max_length=2048)
    refresh_token = models.CharField(max_length=2048)
    token_uri = models.URLField()
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(max_length=255)
    scopes = models.TextField()
    
    def __str__(self):
        return f"Credenciales de Google para {self.user.username}"