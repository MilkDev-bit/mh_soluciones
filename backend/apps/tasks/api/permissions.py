from rest_framework import permissions
from ..models import Task

class IsOwnerOrAdmin(permissions.BasePermission):
    """
    Permiso para permitir que solo el propietario de un objeto (ej. un comentario)
    o un administrador puedan editarlo o eliminarlo.
    """
    def has_object_permission(self, request, view, obj):
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR']:
            return True
        
        author_field = getattr(obj, 'user', getattr(obj, 'submitted_by', None))
        return author_field == request.user

class CanInteractWithTask(permissions.BasePermission):
    """
    Permiso que verifica si un usuario puede interactuar con una tarea
    (ver comentarios, hacer entregas, etc.).
    Permitido si es un administrador, el creador de la tarea, el responsable asignado
    o uno de los estudiantes asignados.
    """
    def _get_task(self, view):
        """Método auxiliar para obtener la tarea desde la URL."""
        try:
            # Agregamos prefetch_related para buscar en assigned_students
            return Task.objects.prefetch_related('assigned_students').select_related('created_by', 'assigned_to').get(pk=view.kwargs['task_pk'])
        except (Task.DoesNotExist, KeyError):
            return None

    def has_permission(self, request, view):
        """
        Se ejecuta para acciones de lista y creación.
        """
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR']:
            return True
        
        task = self._get_task(view)
        if not task:
            return False

        # Verificamos tanto el creador, como el responsable directo (assigned_to)
        # o si el estudiante está en la lista de asignados (assigned_students)
        return (request.user == task.created_by or 
                request.user == task.assigned_to or 
                task.assigned_students.filter(id=request.user.id).exists())
    
    def has_object_permission(self, request, view, obj):
        """
        Se ejecuta para acciones de detalle sobre un objeto existente.
        """
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR']:
            return True
        
        task = obj.task
        return (request.user == task.created_by or 
                request.user == task.assigned_to or 
                task.assigned_students.filter(id=request.user.id).exists())