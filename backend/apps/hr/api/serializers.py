from rest_framework import serializers
from ..models import EmployeeDocument, PerformanceReview, Attendance
from apps.authentication.api.serializers import UserSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class EmployeeDocumentSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo de Documentos de Empleado.
    """
    employee = UserSerializer(read_only=True)
    uploaded_by = UserSerializer(read_only=True)
    
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='employee', 
        write_only=True,
        help_text="ID del empleado al que pertenece el documento."
    )

    class Meta:
        model = EmployeeDocument
        fields = [
            'id',
            'employee',
            'employee_id',
            'document_type',
            'title',
            'file',
            'created_at',
            'uploaded_by',
        ]
        read_only_fields = ('id', 'created_at', 'uploaded_by', 'employee')


class PerformanceReviewSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo de Evaluaciones de Desempeño.
    """
    employee = UserSerializer(read_only=True)
    reviewer = UserSerializer(read_only=True)

    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='employee',
        write_only=True,
        help_text="ID del empleado evaluado."
    )

    class Meta:
        model = PerformanceReview
        fields = [
            'id',
            'employee',
            'employee_id',
            'reviewer',
            'review_date',
            'overall_rating',
            'strengths',
            'areas_for_improvement',
            'comments',
            'created_at',
        ]
        read_only_fields = ('id', 'created_at', 'reviewer', 'employee')


class AttendanceSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo de Asistencia del Personal.
    """
    employee = UserSerializer(read_only=True)
    recorded_by = UserSerializer(read_only=True)
    
    employee_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='employee',
        write_only=True,
        help_text="ID del empleado."
    )

    class Meta:
        model = Attendance
        fields = [
            'id',
            'employee',
            'employee_id',
            'date',
            'status',
            'check_in_time',
            'check_out_time',
            'notes',
            'recorded_by',
            'created_at',
        ]
        read_only_fields = ('id', 'created_at', 'recorded_by', 'employee')