from rest_framework import permissions

class IsOwnerOrAdminReadOnly(permissions.BasePermission):
    """
    Permiso personalizado para que solo el dueño pueda editar
    y los admins puedan leer todo.
    """
    
    def has_permission(self, request, view):
        if request.method == 'POST':
            return request.user and request.user.is_authenticated
        
        return request.user and request.user.is_authenticated
    
    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO']:
            return True
        
        if obj.uploaded_by == request.user:
            return True
        
        if hasattr(obj, 'project') and obj.project:
            return obj.project.members.filter(id=request.user.id).exists()
        
        if hasattr(obj, 'task') and obj.task and obj.task.project:
            return obj.task.project.members.filter(id=request.user.id).exists()
        
        return False