from django.apps import AppConfig
from django.utils.translation import gettext_lazy as _


class CalendarConfig(AppConfig):
    """
    Configuration for the 'calendar' app.
    This app will handle project-specific calendar events.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.calendar'
    verbose_name = _('Calendar')