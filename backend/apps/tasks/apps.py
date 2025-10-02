from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class TasksConfig(AppConfig):
    """
    Configuration for the 'tasks' app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tasks'
    verbose_name = _('Tasks')

    def ready(self):
        """
        Importa las señales cuando la aplicación está lista.
        Esta función es crucial para que las señales de notificación funcionen.
        """
        import apps.tasks.signals