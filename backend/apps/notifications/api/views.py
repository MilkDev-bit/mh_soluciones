from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from apps.notifications.models import Notification, PushSubscription
from .serializers import NotificationSerializer, PushSubscriptionSerializer, SendPushNotificationSerializer
from apps.notifications.push_utils import vapid_config, send_notification_to_user, send_notification_to_multiple_users
from django.contrib.auth import get_user_model
import logging

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['GET'])
@permission_classes([])  # Public endpoint
@ratelimit(key='ip', rate='30/m', method='GET')
def get_vapid_public_key(request):
    """
    Retorna la clave pública VAPID para suscripciones push.
    Este endpoint es público y solo retorna la clave pública (seguro).
    Rate limited to prevent abuse.
    """
    public_key = vapid_config.get_public_key()
    
    if not public_key:
        return Response(
            {'error': 'VAPID not configured on server'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    return Response({'public_key': public_key})


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para ver notificaciones y marcarlas como leídas.
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Asegura que cada usuario solo pueda ver sus propias notificaciones.
        Por defecto, solo muestra las notificaciones no leídas y recientes.
        """
        user = self.request.user
        
        # Log para depuración (temporal)
        logger.debug(f"Fetching notifications for user: {user.username} (ID: {user.id})")
        
        # Ordenar por fecha de creación (más recientes primero)
        queryset = user.notifications.all().order_by('-created_at')
        
        # Por defecto, solo mostrar notificaciones no leídas
        include_read = self.request.query_params.get('include_read', 'false').lower() == 'true'
        if not include_read:
            queryset = queryset.filter(is_read=False)
        
        # Don't slice the queryset here - let DRF's pagination handle it
        # This ensures the response includes pagination metadata (results, count, next, previous)
        return queryset

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """
        Obtener el número de notificaciones no leídas
        """
        # Get base queryset without limit to avoid "Cannot filter a query once a slice has been taken" error
        count = request.user.notifications.filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """
        Marcar todas las notificaciones como leídas
        """
        # Get base queryset without limit to avoid "Cannot filter a query once a slice has been taken" error
        updated_count = request.user.notifications.filter(is_read=False).update(is_read=True)
        return Response({'marked_read': updated_count})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """
        Marcar una notificación específica como leída.
        Busca en TODAS las notificaciones del usuario (no solo las no leídas)
        para evitar 404 cuando se llama dos veces o cuando el WebSocket ya
        marcó la notificación antes de que llegue la petición HTTP.
        """
        try:
            notification = request.user.notifications.get(pk=pk)
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notificación no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
            return Response({'status': 'marked_as_read'})
        return Response({'status': 'already_read'})


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar suscripciones de push notifications.
    """
    serializer_class = PushSubscriptionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Retorna solo las suscripciones del usuario actual.
        """
        return PushSubscription.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """
        Asigna el usuario actual a la suscripción.
        """
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['post'])
    def unsubscribe(self, request):
        """
        Desactiva todas las suscripciones del usuario o una específica.
        """
        endpoint = request.data.get('endpoint')
        
        if endpoint:
            # Desactivar suscripción específica
            updated = PushSubscription.objects.filter(
                user=request.user,
                endpoint=endpoint
            ).update(is_active=False)
            
            return Response({
                'status': 'unsubscribed',
                'count': updated
            })
        else:
            # Desactivar todas las suscripciones del usuario
            updated = PushSubscription.objects.filter(
                user=request.user,
                is_active=True
            ).update(is_active=False)
            
            return Response({
                'status': 'all_unsubscribed',
                'count': updated
            })
    
    @action(detail=False, methods=['post'])
    def send_test(self, request):
        """
        Envía una notificación push de prueba al usuario actual.
        """
        if not vapid_config.is_valid():
            return Response(
                {'error': 'VAPID not configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        
        notification_data = {
            'title': 'Notificación de Prueba',
            'body': 'Esta es una notificación push de prueba desde MH Soluciones',
            'icon': '/icons/icon-192x192.png',
            'tag': 'test-notification'
        }
        
        sent_count = send_notification_to_user(request.user, notification_data)
        
        if sent_count > 0:
            return Response({
                'status': 'sent',
                'count': sent_count
            })
        else:
            return Response({
                'error': 'No active subscriptions or sending failed'
            }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_push_notification(request):
    """
    Envía una notificación push a usuarios específicos.
    Solo usuarios con permisos adecuados pueden enviar a otros usuarios.
    """
    serializer = SendPushNotificationSerializer(data=request.data)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    if not vapid_config.is_valid():
        return Response(
            {'error': 'VAPID not configured'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE
        )
    
    data = serializer.validated_data
    user_ids = data.get('user_ids', [])
    
    notification_data = {
        'title': data['title'],
        'body': data['body'],
        'icon': data.get('icon', '/icons/icon-192x192.png'),
        'tag': data.get('tag', 'notification')
    }
    
    if data.get('url'):
        notification_data['url'] = data['url']
    
    # Si no se especifican usuarios, notificar solo al usuario actual
    if not user_ids:
        sent_count = send_notification_to_user(request.user, notification_data)
        return Response({
            'status': 'sent',
            'users_notified': 1 if sent_count > 0 else 0,
            'subscriptions_sent': sent_count
        })
    
    # Verificar permisos para enviar a otros usuarios
    # Solo admins y staff pueden enviar a múltiples usuarios
    if not (request.user.is_staff or request.user.is_superuser):
        return Response(
            {'error': 'Permission denied. Only staff can send to multiple users.'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    # Obtener usuarios
    users = User.objects.filter(id__in=user_ids)
    
    if not users.exists():
        return Response(
            {'error': 'No valid users found'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Enviar notificaciones
    stats = send_notification_to_multiple_users(list(users), notification_data)
    
    return Response({
        'status': 'sent',
        'statistics': stats
    })