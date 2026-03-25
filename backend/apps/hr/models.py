from django.db import models
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.core.validators import validate_file_extension

class EmployeeDocument(TimeStampedModel):
    """
    Modelo para almacenar los documentos del expediente de un empleado.
    """
    class DocumentType(models.TextChoices):
        CV = 'CV', _('Currículum Vitae')
        ID = 'ID', _('Identificación Oficial')
        CONTRACT = 'CONTRACT', _('Contrato')
        CERTIFICATION = 'CERTIFICATION', _('Certificación')
        OTHER = 'OTHER', _('Otro')

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='employee_documents',
        verbose_name=_("Empleado")
    )
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        verbose_name=_("Tipo de Documento")
    )
    title = models.CharField(
        max_length=255,
        verbose_name=_("Título del Documento")
    )
    file = models.FileField(
        upload_to='hr_documents/%Y/%m/',
        validators=[validate_file_extension],
        verbose_name=_("Archivo")
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_hr_documents',
        verbose_name=_("Subido por (RH)")
    )

    class Meta:
        verbose_name = _("Documento de Empleado")
        verbose_name_plural = _("Documentos de Empleados")
        ordering = ['employee', '-created_at']

    def __str__(self):
        return f"{self.get_document_type_display()} - {self.employee.get_full_name()}"

class PerformanceReview(TimeStampedModel):
    """
    Modelo para registrar las evaluaciones de desempeño de los empleados.
    """
    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='performance_reviews',
        verbose_name=_("Empleado Evaluado")
    )
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='conducted_reviews',
        verbose_name=_("Evaluador")
    )
    review_date = models.DateField(verbose_name=_("Fecha de Evaluación"))
    overall_rating = models.PositiveSmallIntegerField(
        verbose_name=_("Calificación General (1-5)"),
        help_text=_("Calificación del 1 (necesita mejorar) al 5 (excelente).")
    )
    strengths = models.TextField(verbose_name=_("Fortalezas"))
    areas_for_improvement = models.TextField(verbose_name=_("Áreas de Mejora"))
    comments = models.TextField(blank=True, verbose_name=_("Comentarios Adicionales"))

    class Meta:
        verbose_name = _("Evaluación de Desempeño")
        verbose_name_plural = _("Evaluaciones de Desempeño")
        ordering = ['employee', '-review_date']

    def __str__(self):
        return f"Evaluación de {self.employee.get_full_name()} el {self.review_date}"

class Attendance(TimeStampedModel):
    """
    Modelo para registrar la asistencia del personal.
    """
    class AttendanceStatus(models.TextChoices):
        PRESENT = 'PRESENT', _('Presente')
        ABSENT = 'ABSENT', _('Ausente')
        LATE = 'LATE', _('Tardanza')
        SICK_LEAVE = 'SICK_LEAVE', _('Incapacidad')
        VACATION = 'VACATION', _('Vacaciones')
        REMOTE = 'REMOTE', _('Trabajo Remoto')

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name=_("Empleado")
    )
    date = models.DateField(verbose_name=_("Fecha"))
    status = models.CharField(
        max_length=20,
        choices=AttendanceStatus.choices,
        verbose_name=_("Estado de Asistencia")
    )
    check_in_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_("Hora de Entrada")
    )
    check_out_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_("Hora de Salida")
    )
    notes = models.TextField(
        blank=True,
        verbose_name=_("Notas / Observaciones")
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_attendances',
        verbose_name=_("Registrado por")
    )

    class Meta:
        verbose_name = _("Registro de Asistencia")
        verbose_name_plural = _("Registros de Asistencia")
        ordering = ['-date', 'employee']
        unique_together = ['employee', 'date']

    def __str__(self):
        return f"{self.employee.get_full_name()} - {self.date} ({self.get_status_display()})"