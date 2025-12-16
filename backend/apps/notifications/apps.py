from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class NotificationsConfig(AppConfig):
    """
    Configuration for the 'notifications' app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'
    verbose_name = _('Notifications')
    
    def ready(self):
        """
        Código que se ejecuta cuando la aplicación está lista.
        Valida la configuración de VAPID al iniciar.
        """
        from apps.notifications.push_utils import vapid_config
        vapid_config.validate_on_startup()