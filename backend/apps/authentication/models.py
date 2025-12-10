from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from cryptography.fernet import Fernet
import base64


def get_encryption_key():
    """Obtiene la clave de encriptación desde settings"""
    from django.conf import settings
    key = settings.SECRET_KEY[:32].encode()  # Usar los primeros 32 caracteres
    return base64.urlsafe_b64encode(key.ljust(32)[:32])


class EncryptedCharField(models.TextField):
    """Campo de texto encriptado para datos sensibles"""
    
    def get_prep_value(self, value):
        if value is None or value == '':
            return value
        
        fernet = Fernet(get_encryption_key())
        encrypted_value = fernet.encrypt(value.encode())
        return encrypted_value.decode()
    
    def from_db_value(self, value, expression, connection):
        if value is None or value == '':
            return value
        
        try:
            fernet = Fernet(get_encryption_key())
            decrypted_value = fernet.decrypt(value.encode())
            return decrypted_value.decode()
        except Exception:
            return value
    
    def to_python(self, value):
        if isinstance(value, str) or value is None:
            return value
        return str(value)


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
    
    # Security enhancements
    password_changed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Contraseña Cambiada En")
    )
    failed_login_attempts = models.IntegerField(
        default=0,
        verbose_name=_("Intentos Fallidos de Login")
    )
    account_locked_until = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name=_("Cuenta Bloqueada Hasta")
    )
    force_password_change = models.BooleanField(
        default=False,
        verbose_name=_("Forzar Cambio de Contraseña")
    )
    
    def is_password_expired(self):
        """Verifica si la contraseña ha expirado (90 días)"""
        from django.utils import timezone
        from datetime import timedelta
        
        if not self.password_changed_at:
            return False
        
        expiry_date = self.password_changed_at + timedelta(days=90)
        return timezone.now() > expiry_date
    
    def is_account_locked(self):
        """Verifica si la cuenta está bloqueada"""
        from django.utils import timezone
        
        if not self.account_locked_until:
            return False
        
        if timezone.now() < self.account_locked_until:
            return True
        
        # Si el tiempo de bloqueo ha pasado, desbloquear automáticamente
        self.account_locked_until = None
        self.failed_login_attempts = 0
        self.save(update_fields=['account_locked_until', 'failed_login_attempts'])
        return False
    
    def lock_account(self, minutes=30):
        """Bloquea la cuenta por un tiempo específico"""
        from django.utils import timezone
        from datetime import timedelta
        
        self.account_locked_until = timezone.now() + timedelta(minutes=minutes)
        self.save(update_fields=['account_locked_until'])
    
    def increment_failed_login(self):
        """Incrementa el contador de intentos fallidos y bloquea si es necesario"""
        self.failed_login_attempts += 1
        
        # Bloquear después de 5 intentos fallidos
        if self.failed_login_attempts >= 5:
            self.lock_account(30)  # Bloquear por 30 minutos
        
        self.save(update_fields=['failed_login_attempts'])
    
    def reset_failed_login(self):
        """Resetea el contador de intentos fallidos"""
        self.failed_login_attempts = 0
        self.save(update_fields=['failed_login_attempts'])


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
    Los tokens están encriptados en la base de datos.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='google_credentials'
    )
    access_token = EncryptedCharField()
    refresh_token = EncryptedCharField()
    token_uri = models.URLField()
    client_id = models.CharField(max_length=255)
    client_secret = EncryptedCharField()
    scopes = models.TextField()
    
    def __str__(self):
        return f"Credenciales de Google para {self.user.username}"