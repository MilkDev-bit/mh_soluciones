import logging
from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from apps.core.pagination import AuditLogPagination

from apps.core.models import RegistroActividad
from apps.core.permissions import IsSuperAdmin
from .serializers import AuditLogSerializer

logger = logging.getLogger(__name__)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Endpoint de solo lectura para el log de auditoría.
    Acceso exclusivo para SUPERADMIN.

    Filtros disponibles (query params):
      - usuario_id    : ID del usuario actor
      - fecha_desde   : ISO date (YYYY-MM-DD)
      - fecha_hasta   : ISO date (YYYY-MM-DD)
      - accion        : código de acción (ej: TAREA_CREADA)
      - search        : texto libre contra descripción
    """
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    pagination_class = AuditLogPagination

    def get_queryset(self):
        qs = (
            RegistroActividad.objects
            .select_related('usuario')
            .only(
                'id', 'accion', 'descripcion', 'proyecto_id', 'tarea_id',
                'metadata', 'actor_username', 'created_at',
                'usuario__id', 'usuario__username', 'usuario__email',
                'usuario__first_name', 'usuario__last_name', 'usuario__role',
            )
            .order_by('-created_at')
        )

        params = self.request.query_params

        usuario_id = params.get('usuario_id')
        if usuario_id:
            qs = qs.filter(usuario_id=usuario_id)

        fecha_desde = params.get('fecha_desde')
        if fecha_desde:
            qs = qs.filter(created_at__date__gte=fecha_desde)

        fecha_hasta = params.get('fecha_hasta')
        if fecha_hasta:
            qs = qs.filter(created_at__date__lte=fecha_hasta)

        accion = params.get('accion')
        if accion:
            qs = qs.filter(accion=accion)

        search = params.get('search')
        if search:
            qs = qs.filter(descripcion__icontains=search)

        return qs

    # Exponer las opciones de acción para el filtro del frontend
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)
