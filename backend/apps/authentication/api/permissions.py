from rest_framework.permissions import BasePermission

class IsSuperAdmin(BasePermission):
    """
    Permite el acceso solo a usuarios que tienen el rol de SUPERADMIN.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'SUPERADMIN'
