from rest_framework import permissions
from rest_framework.permissions import BasePermission
from apps.projects.models import ProjectMember

class CanInteractInProject(BasePermission):
    """
    Permite la interacción (ej. comentar) si el usuario
    es un administrador o un miembro registrado del proyecto.
    Los clientes asignados al proyecto solo pueden leer (SAFE_METHODS).
    Esta clase está diseñada para vistas anidadas que reciben un 'project_pk' en la URL.
    """
    def has_permission(self, request, view):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            return True

        project_id = view.kwargs.get('project_pk')
        if not project_id:
            return False

        # Clients can only read (list/retrieve), not create/edit/delete
        if request.user.role == 'CLIENT':
            if request.method not in ('GET', 'HEAD', 'OPTIONS'):
                return False
            from apps.projects.models import Project
            return Project.objects.filter(id=project_id, client=request.user).exists()

        return ProjectMember.objects.filter(
            project_id=project_id,
            user=request.user
        ).exists()

class IsAdminRole(BasePermission):
    """
    Permiso que solo permite acceso a usuarios con roles administrativos.
    Ideal para acciones como la creación de entregas generales del proyecto.
    """
    def has_permission(self, request, view):
        return request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']
    

class IsOwnerOrAdmin(BasePermission):
    """
    Permiso personalizado para permitir que solo el propietario de un objeto
    o un administrador puedan editarlo o eliminarlo.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']:
            return True
        author_field = getattr(obj, 'user', getattr(obj, 'submitted_by', None))
        return author_field == request.user

class IsProjectMemberOrAdmin(permissions.BasePermission):
    """
    Permite acceso total a administradores.
    Permite solo lectura a miembros.
    """

    def has_permission(self, request, view):
        if view.action in ['list', 'retrieve']:
            return request.user and request.user.is_authenticated
        return request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'RH']

    def has_object_permission(self, request, view, obj):
        user = request.user

        is_member  = obj.members.filter(pk=user.pk).exists()
        is_creator = obj.created_by_id == user.pk
        is_client  = obj.client_id == user.pk

        return is_member or is_creator or is_client