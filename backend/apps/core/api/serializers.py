from rest_framework import serializers
from apps.core.models import RegistroActividad
from apps.authentication.models import CustomUser


class AuditActorSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'role']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AuditLogSerializer(serializers.ModelSerializer):
    usuario = AuditActorSerializer(read_only=True)
    accion_display = serializers.CharField(source='get_accion_display', read_only=True)

    class Meta:
        model = RegistroActividad
        fields = [
            'id',
            'usuario',
            'actor_username',
            'accion',
            'accion_display',
            'descripcion',
            'proyecto_id',
            'tarea_id',
            'metadata',
            'created_at',
        ]
        read_only_fields = fields
