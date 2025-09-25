from rest_framework import permissions
from apps.projects.models import ProjectMember

class IsProjectMemberForCalendar(permissions.BasePermission):
    """
    Permiso personalizado para eventos del calendario.
    - Permite crear si eres miembro del proyecto.
    - Permite ver/editar/eliminar si eres miembro del proyecto del evento.
    - Los administradores tienen acceso total.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO']:
            return True

        if view.action == 'create':
            project_id = request.data.get('project')
            if not project_id:
                return False
            return ProjectMember.objects.filter(project_id=project_id, user=request.user).exists()
        
        return True

    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO']:
            return True
        
        return ProjectMember.objects.filter(project=obj.project, user=request.user).exists()