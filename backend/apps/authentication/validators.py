"""
Custom password validators for enhanced security.
"""
import re
from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _
from .constants import (
    SPECIAL_CHARS_PATTERN, 
    PASSWORD_MIN_LENGTH,
    PASSWORD_EXPIRY_DAYS
)


class StrongPasswordValidator:
    """
    Validator para contraseñas fuertes que requiere:
    - Mínimo 12 caracteres
    - Al menos una letra mayúscula
    - Al menos una letra minúscula
    - Al menos un número
    - Al menos un carácter especial
    """
    
    def validate(self, password, user=None):
        if len(password) < PASSWORD_MIN_LENGTH:
            raise ValidationError(
                _(f"La contraseña debe tener al menos {PASSWORD_MIN_LENGTH} caracteres."),
                code='password_too_short',
            )
        
        if not re.search(r'[A-Z]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos una letra mayúscula."),
                code='password_no_upper',
            )
        
        if not re.search(r'[a-z]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos una letra minúscula."),
                code='password_no_lower',
            )
        
        if not re.search(r'[0-9]', password):
            raise ValidationError(
                _("La contraseña debe contener al menos un número."),
                code='password_no_digit',
            )
        
        if not re.search(SPECIAL_CHARS_PATTERN, password):
            raise ValidationError(
                _("La contraseña debe contener al menos un carácter especial (!@#$%^&*, etc.)."),
                code='password_no_special',
            )
    
    def get_help_text(self):
        return _(
            f"Tu contraseña debe tener al menos {PASSWORD_MIN_LENGTH} caracteres, incluyendo "
            "mayúsculas, minúsculas, números y caracteres especiales."
        )


class PasswordExpiryValidator:
    """
    Validator que verifica si la contraseña ha expirado (90 días).
    """
    
    def validate(self, password, user=None):
        # Esta validación se maneja en el modelo y middleware
        # Este validator está aquí para completar la suite de validaciones
        pass
    
    def get_help_text(self):
        return _(f"Las contraseñas deben cambiarse cada {PASSWORD_EXPIRY_DAYS} días por seguridad.")


class CompromisedPasswordValidator:
    """
    Validator que verifica si la contraseña está en una lista de contraseñas comprometidas.
    """
    
    # Lista de contraseñas comunes y comprometidas (solo ejemplos, en producción usar una base más amplia)
    COMPROMISED_PASSWORDS = {
        'password123', 'admin123', 'qwerty123', '12345678', 'password',
        'welcome123', 'letmein123', 'admin', 'root', 'toor',
        '123456', '12345678', '123456789', 'test', 'password1234',
        'abc123', 'monkey', '1234567890', 'mynoob', '123321',
        'qwerty', 'password1', 'password12', 'password123!', 'Password123',
        'Password123!', 'Welcome123', 'Welcome123!', 'Admin123', 'Admin123!',
    }
    
    def validate(self, password, user=None):
        # Normalizar a minúsculas para comparación
        password_lower = password.lower()
        
        if password_lower in self.COMPROMISED_PASSWORDS:
            raise ValidationError(
                _("Esta contraseña es muy común y no es segura. Por favor elige una diferente."),
                code='password_too_common',
            )
        
        # Verificar patrones comunes
        if re.match(r'^(.)\1+$', password):  # Todos los caracteres iguales
            raise ValidationError(
                _("La contraseña no puede consistir de caracteres repetidos."),
                code='password_too_simple',
            )
    
    def get_help_text(self):
        return _("La contraseña no debe ser una contraseña común o comprometida.")
