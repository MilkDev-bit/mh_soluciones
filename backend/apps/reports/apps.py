from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class ReportsConfig(AppConfig):
    """
    Configuration for the 'reports' app.
    This app will handle data aggregation for dashboards.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.reports'
    verbose_name = _('Reports and Dashboards')