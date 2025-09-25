from django.contrib import admin
from .models import CalendarEvent

@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    """
    Configuración del panel de administrador para los Eventos del Calendario.
    """
    list_display = ('title', 'project', 'start_time', 'end_time', 'created_by', 'color')
    list_filter = ('project', 'start_time', 'color')
    search_fields = ('title', 'description', 'project__name', 'created_by__username')
    raw_id_fields = ('project', 'created_by')
    ordering = ('-start_time',)
    list_per_page = 25