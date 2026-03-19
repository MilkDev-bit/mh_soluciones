from rest_framework import serializers
from apps.notifications.models import Notification, PushSubscription

class NotificationSerializer(serializers.ModelSerializer):

    action_url = serializers.SerializerMethodField()

    """
    Serializador para el modelo Notification.
    """
    class Meta:
        model = Notification
        fields = [
            'id',
            'title',
            'message',
            'is_read',
            'notification_type',
            'created_at',
            'action_url'
        ]

    def get_action_url(self, obj):
        try:
            if not obj.content_type:
                return None
                
            if obj.content_type.model == 'task':
                task = obj.content_object
                if task and hasattr(task, 'project') and task.project:
                    return f"/projects/{task.project.id}?taskId={task.id}"
                    
            elif obj.content_type.model == 'project':
                project = obj.content_object
                if project:
                    return f"/projects/{project.id}"
                    
            return None
        except Exception:
            return None


class PushSubscriptionSerializer(serializers.ModelSerializer):
    """
    Serializador para el modelo PushSubscription.
    """
    class Meta:
        model = PushSubscription
        fields = ['id', 'endpoint', 'p256dh', 'auth', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def validate_endpoint(self, value):
        """
        Valida que el endpoint sea una URL válida.
        """
        if not value.startswith('https://'):
            raise serializers.ValidationError(
                "El endpoint debe ser una URL HTTPS válida"
            )
        return value
    
    def create(self, validated_data):
        """
        Crea o actualiza una suscripción para el usuario actual.
        """
        user = self.context['request'].user
        endpoint = validated_data['endpoint']
        
        # Buscar si ya existe una suscripción para este endpoint
        subscription, created = PushSubscription.objects.update_or_create(
            user=user,
            endpoint=endpoint,
            defaults={
                'p256dh': validated_data['p256dh'],
                'auth': validated_data['auth'],
                'is_active': True
            }
        )
        
        return subscription


class SendPushNotificationSerializer(serializers.Serializer):
    """
    Serializador para enviar notificaciones push.
    """
    title = serializers.CharField(max_length=255)
    body = serializers.CharField(max_length=500)
    icon = serializers.URLField(required=False, allow_blank=True)
    url = serializers.URLField(required=False, allow_blank=True)
    tag = serializers.CharField(max_length=100, required=False, allow_blank=True)
    user_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        help_text="Lista de IDs de usuarios a notificar. Si está vacío, se notifica al usuario actual."
    )