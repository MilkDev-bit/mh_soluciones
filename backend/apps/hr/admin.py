from django.contrib import admin
from .models import EmployeeDocument, PerformanceReview, Attendance

@admin.register(EmployeeDocument)
class EmployeeDocumentAdmin(admin.ModelAdmin):
    """
    Configuración del panel de administrador para los documentos de empleados.
    """
    list_display = ('employee', 'document_type', 'title', 'uploaded_by', 'created_at')
    list_filter = ('document_type', 'created_at')
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name', 'title')
    
    raw_id_fields = ('employee', 'uploaded_by')
    
    ordering = ('-created_at',)
    
    list_per_page = 25


@admin.register(PerformanceReview)
class PerformanceReviewAdmin(admin.ModelAdmin):
    """
    Configuración del panel de administrador para las evaluaciones de desempeño.
    """
    list_display = ('employee', 'reviewer', 'review_date', 'overall_rating')
    list_filter = ('review_date', 'overall_rating')
    search_fields = ('employee__username', 'reviewer__username', 'employee__first_name')
    raw_id_fields = ('employee', 'reviewer')
    ordering = ('-review_date',)
    list_per_page = 25


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    """
    Configuración del panel de administrador para los registros de asistencia.
    """
    list_display = ('employee', 'date', 'status', 'check_in_time', 'check_out_time', 'recorded_by')
    list_filter = ('status', 'date', 'employee')
    search_fields = ('employee__username', 'employee__first_name', 'employee__last_name')
    raw_id_fields = ('employee', 'recorded_by')
    ordering = ('-date', 'employee')
    list_per_page = 25
    date_hierarchy = 'date'