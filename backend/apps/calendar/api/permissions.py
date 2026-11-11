from rest_framework import permissions
from apps.core.permissions import TEACHER_ROLES
from apps.projects.models import ProjectMember

# Ven el calendario de todos los proyectos.
GLOBAL_VIEW_ROLES = ('SUPERADMIN', 'ADMIN', 'CEO', 'RH')


def can_manage_event(user, event):
    """Puede mover/editar/borrar: personal docente/administrativo o quien lo creó."""
    return user.role in TEACHER_ROLES or (event.created_by_id is not None and event.created_by_id == user.id)


class IsProjectMemberForCalendar(permissions.BasePermission):
    """
    Permisos de eventos del calendario.
    - Ver: miembros del proyecto (y roles con vista global).
    - Crear: miembros del proyecto o personal docente/administrativo.
    - Editar/eliminar: personal docente/administrativo o el creador del
      evento. [FIX] Antes cualquier miembro (p. ej. un alumno) podía mover o
      borrar los eventos que creó el profesor.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role in TEACHER_ROLES:
            return True

        if view.action == 'create':
            project_id = request.data.get('project')
            if not project_id:
                return False
            return ProjectMember.objects.filter(project_id=project_id, user=request.user).exists()

        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if request.method in permissions.SAFE_METHODS:
            if user.role in TEACHER_ROLES or user.role in GLOBAL_VIEW_ROLES:
                return True
            return ProjectMember.objects.filter(project=obj.project, user=user).exists()
        return can_manage_event(user, obj)
