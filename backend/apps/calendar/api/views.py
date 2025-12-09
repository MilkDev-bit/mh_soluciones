from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Q, Prefetch
from django.utils import timezone
import logging

from ..models import CalendarEvent
from apps.projects.models import Project, ProjectMember
from .serializers import CalendarEventSerializer
from .permissions import IsProjectMemberForCalendar
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
        
        # Filtrar por rango de fechas si se especifica
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            try:
                queryset = queryset.filter(start_time__gte=start_date)
            except Exception as e:
                logger.warning(f"Invalid start_date parameter: {start_date}, error: {e}")
        
        if end_date:
            try:
                queryset = queryset.filter(end_time__lte=end_date)
            except Exception as e:
                logger.warning(f"Invalid end_date parameter: {end_date}, error: {e}")
        
        return queryset

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
        if user.role not in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            if not ProjectMember.objects.filter(project=project, user=user).exists():
                raise ValidationError({
                    'project': 'No tienes permisos para crear eventos en este proyecto.'
                })
        
        try:
            event = serializer.save(created_by=user)
            logger.info(f"Event created by {user.email} for project {project.id}")
            
            # Send email notification
            send_calendar_event_notification(event, action='created')
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            raise ValidationError({
                'detail': 'Error al crear el evento. Por favor, intenta nuevamente.'
            })

    def perform_update(self, serializer):
        """
        Maneja la actualización de eventos con logging.
        Envía notificación por email.
        """
        try:
            instance = serializer.save()
            logger.info(f"Event {instance.id} updated by {self.request.user.email}")
            
            # Send email notification
            send_calendar_event_notification(instance, action='updated')
        except Exception as e:
            logger.error(f"Error updating event: {e}")
            raise ValidationError({
                'detail': 'Error al actualizar el evento. Por favor, intenta nuevamente.'
            })

    def perform_destroy(self, instance):
        """
        Maneja la eliminación de eventos con logging.
        Envía notificación por email.
        """
        try:
            event_id = instance.id
            # Send email notification before deleting
            send_calendar_event_notification(instance, action='deleted')
            instance.delete()
            logger.info(f"Event {event_id} deleted by {self.request.user.email}")
        except Exception as e:
            logger.error(f"Error deleting event: {e}")
            raise ValidationError({
                'detail': 'Error al eliminar el evento. Por favor, intenta nuevamente.'
            })

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