from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from ..models import CalendarEvent
from apps.authentication.api.serializers import UserSerializer

class CalendarEventSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo CalendarEvent.
    Incluye validaciones mejoradas y manejo de errores.
    """
    created_by = UserSerializer(read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'project',
            'project_name',
            'title',
            'description',
            'start_time',
            'end_time',
            'created_by',
            'color',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at', 'project_name')

    def validate_title(self, value):
        """
        Valida que el título no esté vacío y tenga una longitud adecuada.
        """
        if not value or not value.strip():
            raise serializers.ValidationError("El título no puede estar vacío.")
        
        if len(value) > 255:
            raise serializers.ValidationError("El título no puede exceder los 255 caracteres.")
        
        return value.strip()

    def validate_color(self, value):
        """
        Valida que el color sea un código hexadecimal válido.
        """
        if value and not value.startswith('#'):
            raise serializers.ValidationError("El color debe ser un código hexadecimal válido (ejemplo: #2C74B3).")
        
        if value and len(value) not in [4, 7]:  # #RGB or #RRGGBB
            raise serializers.ValidationError("El color debe tener el formato #RGB o #RRGGBB.")
        
        return value

    def validate(self, data):
        """
        Validaciones a nivel de objeto:
        1. La fecha de fin debe ser posterior a la de inicio
        2. El evento no puede durar más de 365 días
        3. El evento no puede estar en el pasado distante (más de 5 años)
        """
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        
        # Validación de fechas
        if start_time and end_time:
            if end_time <= start_time:
                raise serializers.ValidationError({
                    'end_time': "La fecha de finalización debe ser posterior a la fecha de inicio."
                })
            
            # Validar que el evento no dure más de 365 días
            duration = end_time - start_time
            if duration > timedelta(days=365):
                raise serializers.ValidationError({
                    'end_time': "El evento no puede durar más de 365 días."
                })
            
            # Validar que el evento no esté en el pasado distante
            five_years_ago = timezone.now() - timedelta(days=365*5)
            if start_time < five_years_ago:
                raise serializers.ValidationError({
                    'start_time': "La fecha de inicio no puede ser anterior a 5 años en el pasado."
                })
        
        return data