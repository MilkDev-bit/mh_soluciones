from rest_framework import serializers
from ..models import CalendarEvent
from apps.authentication.api.serializers import UserSerializer

class CalendarEventSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo CalendarEvent.
    """
    created_by = UserSerializer(read_only=True)

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'project',
            'title',
            'description',
            'start_time',
            'end_time',
            'created_by',
            'color',
        ]
        read_only_fields = ('id', 'created_by')

    def validate(self, data):
        """
        Asegura que la fecha de finalización no sea anterior a la de inicio.
        """
        if 'start_time' in data and 'end_time' in data:
            if data['end_time'] < data['start_time']:
                raise serializers.ValidationError("La fecha de finalización no puede ser anterior a la fecha de inicio.")
        return data