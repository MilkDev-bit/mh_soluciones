from rest_framework.permissions import BasePermission

class IsHrOrSuperAdmin(BasePermission):
    """
    Permiso personalizado que solo permite el acceso a usuarios con el rol
    de 'RH' o 'SUPERADMIN'.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ['RH', 'SUPERADMIN']