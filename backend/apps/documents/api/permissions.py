from rest_framework import permissions

class IsOwnerOrAdminReadOnly(permissions.BasePermission):
    """
    Permiso personalizado para que solo el dueño pueda editar
    y los admins puedan leer todo.
    Los clientes solo pueden leer documentos de sus proyectos.
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        # Clients: read-only, no uploads/edits/deletes
        if request.user.role == 'CLIENT':
            return request.method in permissions.SAFE_METHODS

        return True
    
    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO']:
            return True

        # Clients can only read documents from their projects
        if request.user.role == 'CLIENT':
            if request.method not in permissions.SAFE_METHODS:
                return False
            if hasattr(obj, 'project') and obj.project:
                return obj.project.client_id == request.user.id
            if hasattr(obj, 'task') and obj.task and obj.task.project:
                return obj.task.project.client_id == request.user.id
            return False
        
        if obj.uploaded_by == request.user:
            return True
        
        if hasattr(obj, 'project') and obj.project:
            return obj.project.members.filter(id=request.user.id).exists()
        
        if hasattr(obj, 'task') and obj.task and obj.task.project:
            return obj.task.project.members.filter(id=request.user.id).exists()
        
        return False