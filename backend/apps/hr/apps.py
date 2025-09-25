from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class HrConfig(AppConfig):
    """
    Configuration for the Human Resources ('hr') app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.hr'
    verbose_name = _('Human Resources')