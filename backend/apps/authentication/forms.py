from django import forms
from django.contrib.auth.forms import UserCreationForm, UserChangeForm
from .models import CustomUser


class CustomUserCreationForm(UserCreationForm):
    """
    Un formulario para crear nuevos usuarios, incluyendo el campo de rol.
    Se usa en el panel de administrador al añadir un nuevo usuario.
    """
    class Meta(UserCreationForm.Meta):
        model = CustomUser
        fields = ('username', 'email', 'first_name', 'last_name', 'role')


class CustomUserChangeForm(UserChangeForm):
    """
    Un formulario para actualizar usuarios existentes.
    Se usa en el panel de administrador al editar un usuario.
    """
    class Meta:
        model = CustomUser
        fields = (
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'is_active',
            'is_staff',
            'is_superuser',
            'groups',
            'user_permissions',
            'profile_picture',
            'allowed_ips',
            'requires_2fa'
        )