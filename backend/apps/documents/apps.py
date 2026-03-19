from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _

class DocumentsConfig(AppConfig):
    """
    Configuración de la aplicación "Documents".
    Esta aplicación gestionará la subida y la gestión de archivos.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.documents'
    verbose_name = _('Documents')

    def ready(self):
        import apps.documents.signals