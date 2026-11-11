from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db import connection, transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
import datetime
import logging
import threading

from ..models import CalendarEvent
from apps.projects.models import Project, ProjectMember
from .serializers import CalendarEventSerializer
from .permissions import IsProjectMemberForCalendar
from apps.core.permissions import TEACHER_ROLES
from utils.email_notifications import send_calendar_event_notification

logger = logging.getLogger(__name__)

class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los eventos del calendario de los proyectos.
    Incluye optimizaciones de consultas y manejo mejorado de errores.
    """
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberForCalendar]

    def get_queryset(self):
        """
        Filtra los eventos para que los usuarios solo vean aquellos de los proyectos
        en los que son miembros. Los administradores ven todos.
        Optimizado con select_related y prefetch_related.
        """
        user = self.request.user
        
        # Base queryset optimizado
        queryset = CalendarEvent.objects.select_related(
            'project', 
            'created_by'
        ).order_by('-start_time')
        
        # Filtrar por rol
        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            pass  # Admin users see all events
        else:
            # Get user's project IDs efficiently
            user_project_ids = ProjectMember.objects.filter(
                user=user
            ).values_list('project_id', flat=True)
            
            queryset = queryset.filter(project_id__in=list(user_project_ids))

        # Filtrar por proyecto si se especifica
        project_id = self.request.query_params.get('project_id')
        if project_id:
            try:
                project_id = int(project_id)
                queryset = queryset.filter(project_id=project_id)
            except (ValueError, TypeError):
                logger.warning(f"Invalid project_id parameter: {project_id}")
        
        # Rango visible del calendario. [FIX] Antes se pedía que el evento
        # empezara Y terminara dentro del rango, así que un evento que cruza
        # de un mes a otro no aparecía en ninguno de los dos. Ahora basta con
        # que se traslape con el rango. Fechas inválidas se ignoran.
        range_start = self._parse_bound(self.request.query_params.get('start_date'))
        range_end = self._parse_bound(self.request.query_params.get('end_date'))
        if range_start:
            queryset = queryset.filter(end_time__gt=range_start)
        if range_end:
            queryset = queryset.filter(start_time__lt=range_end)

        return queryset

    @staticmethod
    def _parse_bound(value):
        """'2026-11-01' o ISO con hora → datetime con zona horaria (o None)."""
        if not value:
            return None
        dt = parse_datetime(value)
        if dt is None:
            d = parse_date(value[:10]) if len(value) >= 10 else None
            if d is None:
                logger.warning(f"Invalid date parameter: {value}")
                return None
            dt = datetime.datetime.combine(d, datetime.time.min)
        if timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())
        return dt

    @staticmethod
    def _notify_by_email(event, action):
        """
        [FIX] El correo a todos los miembros se enviaba DENTRO de la petición:
        crear/mover/borrar un evento tardaba lo que tardara el SMTP con cada
        destinatario. Ahora se envía en segundo plano después de guardar, y
        si falla no afecta al evento.
        """
        def _send():
            try:
                send_calendar_event_notification(event, action=action)
            except Exception as e:  # pragma: no cover - solo registro
                logger.error(f"Error enviando correo de evento {getattr(event, 'id', '?')}: {e}")
            finally:
                connection.close()

        # El evento borrado ya no se puede leer de la BD: se cargan antes los
        # datos que usa la plantilla.
        list(event.project.members.all())
        transaction.on_commit(lambda: threading.Thread(target=_send, daemon=True).start())

    def perform_create(self, serializer):
        """
        Asigna automáticamente el usuario que crea el evento.
        Valida que el proyecto exista y el usuario tenga acceso.
        Envía notificación por email.
        """
        project = serializer.validated_data.get('project')
        user = self.request.user
        
        # Verificar que el proyecto existe
        if not Project.objects.filter(id=project.id).exists():
            raise ValidationError({
                'project': 'El proyecto especificado no existe.'
            })
        
        # Verificar que el usuario es miembro del proyecto o es admin
        if user.role not in TEACHER_ROLES:
            if not ProjectMember.objects.filter(project=project, user=user).exists():
                raise ValidationError({
                    'project': 'No tienes permisos para crear eventos en este proyecto.'
                })
        
        event = serializer.save(created_by=user)
        logger.info(f"Event created by {user.email} for project {project.id}")
        self._notify_by_email(event, 'created')

    def perform_update(self, serializer):
        """
        Actualiza el evento. [FIX] Antes cualquier error (incluido el del
        correo) se convertía en "Error al actualizar el evento" aunque el
        evento sí se hubiera guardado.
        """
        instance = serializer.save()
        logger.info(f"Event {instance.id} updated by {self.request.user.email}")
        self._notify_by_email(instance, 'updated')

    def perform_destroy(self, instance):
        event_id = instance.id
        self._notify_by_email(instance, 'deleted')
        instance.delete()
        logger.info(f"Event {event_id} deleted by {self.request.user.email}")

    def list(self, request, *args, **kwargs):
        """
        Override list to add better error handling and response structure.
        """
        try:
            queryset = self.filter_queryset(self.get_queryset())
            
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = self.get_serializer(page, many=True)
                return self.get_paginated_response(serializer.data)

            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'count': queryset.count(),
                'results': serializer.data
            }, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error listing events: {e}")
            return Response({
                'detail': 'Error al obtener los eventos. Por favor, intenta nuevamente.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='available-colors')
    def available_colors(self, request):
        """
        Devuelve los colores únicos que tienen eventos asociados en el proyecto especificado.
        Retorna solo colores de eventos que realmente existen en la base de datos.
        """
        try:
            project_id = request.query_params.get('project_id')
            
            if not project_id:
                return Response({
                    'detail': 'Se requiere el parámetro project_id.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener eventos del proyecto con permisos aplicados
            queryset = self.get_queryset().filter(project_id=project_id)
            
            # Obtener colores únicos de los eventos existentes
            unique_colors = queryset.values_list('color', flat=True).distinct()
            
            # Obtener las etiquetas de los colores desde el modelo
            color_choices = dict(CalendarEvent.EventColor.choices)
            
            # Construir la respuesta con colores que existen en eventos
            available_colors = []
            for color in unique_colors:
                if color:  # Asegurar que el color no sea nulo
                    available_colors.append({
                        'value': color,
                        'label': color_choices.get(color, color),
                        'color': color
                    })
            
            logger.info(f"Retrieved {len(available_colors)} available colors for project {project_id}")
            
            return Response({
                'colors': available_colors,
                'count': len(available_colors)
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error getting available colors: {e}")
            return Response({
                'detail': 'Error al obtener los colores disponibles.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)