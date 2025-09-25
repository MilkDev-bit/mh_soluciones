from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _

from .models import CustomUser, LoginActivity


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    """
    Personaliza la vista del modelo CustomUser en el panel de administración.
    Hereda de UserAdmin para mantener toda la funcionalidad base de Django.
    """
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active')
    
    list_filter = ('role', 'is_staff', 'is_active', 'groups')
    
    search_fields = ('username', 'first_name', 'last_name', 'email')
    
    ordering = ('last_name', 'first_name')

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email', 'profile_picture')}),
        (
            _('Permissions and Role'),
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'role',
                    'groups',
                    'user_permissions',
                ),
            },
        ),
        (_('Security Settings'), {'fields': ('allowed_ips', 'requires_2fa')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    
    readonly_fields = ('last_login', 'date_joined')


@admin.register(LoginActivity)
class LoginActivityAdmin(admin.ModelAdmin):
    """
    Personaliza la vista para los registros de actividad de inicio de sesión.
    """
    list_display = ('user', 'timestamp', 'ip_address', 'successful', 'user_agent')
    list_filter = ('successful', 'timestamp')
    search_fields = ('user__username', 'ip_address', 'user_agent')
    list_per_page = 50
    
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False