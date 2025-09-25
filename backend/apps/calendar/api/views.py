from rest_framework import viewsets, permissions
from ..models import CalendarEvent
from .serializers import CalendarEventSerializer
from .permissions import IsProjectMemberForCalendar

class CalendarEventViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar los eventos del calendario de los proyectos.
    """
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated, IsProjectMemberForCalendar]

    def get_queryset(self):
        """
        Filtra los eventos para que los usuarios solo vean aquellos de los proyectos
        en los que son miembros. Los administradores ven todos.
        """
        user = self.request.user
        
        if user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            queryset = CalendarEvent.objects.all()
        else:
            user_project_ids = user.projectmember_set.values_list('project_id', flat=True)
            queryset = CalendarEvent.objects.filter(project_id__in=user_project_ids)

        project_id = self.request.query_params.get('project_id')
        if project_id:
            queryset = queryset.filter(project_id=project_id)
            
        return queryset.select_related('project', 'created_by')

    def perform_create(self, serializer):
        """
        Asigna automáticamente el usuario que crea el evento.
        La validación de permisos ya se hace en la clase IsProjectMemberForCalendar.
        """
        serializer.save(created_by=self.request.user)