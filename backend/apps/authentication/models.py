from django.db import models
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _
from cryptography.fernet import Fernet
import base64
from .constants import PASSWORD_EXPIRY_DAYS, MAX_FAILED_LOGIN_ATTEMPTS, ACCOUNT_LOCKOUT_MINUTES


def get_encryption_key():
    """
    Obtiene la clave de encriptación desde settings.
    IMPORTANTE: En producción, usar una clave dedicada y segura
    almacenada en variables de entorno.
    """
    from django.conf import settings
    
    # En producción, usar una clave dedicada: ENCRYPTION_KEY
    # Aquí usamos SECRET_KEY solo como fallback para desarrollo
    encryption_key = getattr(settings, 'ENCRYPTION_KEY', settings.SECRET_KEY)
    
    # Asegurar que la clave tenga 32 bytes para Fernet
    key = encryption_key[:32].encode() if isinstance(encryption_key, str) else encryption_key[:32]
    return base64.urlsafe_b64encode(key.ljust(32)[:32])


class EncryptedCharField(models.TextField):
    """Campo de texto encriptado para datos sensibles"""
    
    def get_prep_value(self, value):
        if value is None or value == '':
            return value
        
        try:
            fernet = Fernet(get_encryption_key())
            encrypted_value = fernet.encrypt(value.encode())
            return encrypted_value.decode()
        except Exception as e:
            # En caso de error, loggear pero no fallar la operación
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error encrypting field: {e}")
            return value
    
    def from_db_value(self, value, expression, connection):
        if value is None or value == '':
            return value
        
        try:
            fernet = Fernet(get_encryption_key())
            decrypted_value = fernet.decrypt(value.encode())
            return decrypted_value.decode()
        except Exception as e:
            # Si no se puede desencriptar, retornar el valor original
            # Esto puede pasar si la clave cambió o el valor no estaba encriptado
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Error decrypting field: {e}")
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
        """Verifica si la contraseña ha expirado"""
        from django.utils import timezone
        from datetime import timedelta
        
        if not self.password_changed_at:
            return False
        
        expiry_date = self.password_changed_at + timedelta(days=PASSWORD_EXPIRY_DAYS)
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
    
    def lock_account(self, minutes=ACCOUNT_LOCKOUT_MINUTES):
        """Bloquea la cuenta por un tiempo específico"""
        from django.utils import timezone
        from datetime import timedelta
        
        self.account_locked_until = timezone.now() + timedelta(minutes=minutes)
        self.save(update_fields=['account_locked_until'])
    
    def increment_failed_login(self):
        """Incrementa el contador de intentos fallidos y bloquea si es necesario"""
        self.failed_login_attempts += 1
        
        # Bloquear después de MAX_FAILED_LOGIN_ATTEMPTS intentos fallidos
        if self.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
            self.lock_account()
        
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


class BlockedIP(models.Model):
    ip_address = models.GenericIPAddressField(unique=True, verbose_name=_('Dirección IP'))
    reason = models.CharField(max_length=255, blank=True, verbose_name=_('Motivo del bloqueo'))
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True, verbose_name=_('Bloqueo Activo'))

    class Meta:
        verbose_name = _('IP Bloqueada')
        verbose_name_plural = _('IPs Bloqueadas')

    def __str__(self):
        return f"{self.ip_address} - {self.reason}"