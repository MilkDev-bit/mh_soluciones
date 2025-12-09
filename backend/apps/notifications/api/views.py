from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.notifications.models import Notification
from .serializers import NotificationSerializer

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
        queryset = self.request.user.notifications.all()
        
        # Por defecto, solo mostrar notificaciones no leídas
        include_read = self.request.query_params.get('include_read', 'false').lower() == 'true'
        if not include_read:
            queryset = queryset.filter(is_read=False)
        
        # Limitar a las 50 notificaciones más recientes para optimizar rendimiento
        try:
            limit = int(self.request.query_params.get('limit', 50))
            # Validar que el límite esté en un rango razonable
            limit = max(1, min(limit, 100))  # Entre 1 y 100
        except (ValueError, TypeError):
            limit = 50  # Valor por defecto si hay error
        
        queryset = queryset[:limit]
        
        return queryset

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """
        Obtener el número de notificaciones no leídas
        """
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})

    @action(detail=False, methods=['post'])
    def mark_all_as_read(self, request):
        """
        Marcar todas las notificaciones como leídas
        """
        updated_count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({'marked_read': updated_count})

    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """
        Marcar una notificación específica como leída
        """
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save()
            return Response({'status': 'marked_as_read'})
        return Response({'status': 'already_read'})