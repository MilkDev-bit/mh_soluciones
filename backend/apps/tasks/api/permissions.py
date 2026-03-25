import logging
from rest_framework import permissions
from ..models import Task

logger = logging.getLogger(__name__)

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
    Permitido si es un administrador, el creador de la tarea, el responsable asignado,
    uno de los estudiantes asignados o miembro del proyecto.
    """
    def _get_task(self, view):
        """Método auxiliar para obtener la tarea desde la URL."""
        try:
            task_pk = view.kwargs.get('task_pk')
            if not task_pk:
                return None
            
            # Agregamos prefetch_related para buscar en assigned_students y project members
            return Task.objects.prefetch_related(
                'assigned_students', 
                'project__projectmember_set'
            ).select_related(
                'created_by', 
                'assigned_to',
                'project'
            ).get(pk=task_pk)
        except (Task.DoesNotExist, KeyError) as e:
            logger.warning(f"Task interaction error: Task {view.kwargs.get('task_pk')} not found. {e}")
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
        # O si es miembro del proyecto (siendo estudiante)
        is_creator = request.user == task.created_by
        is_assigned_to = request.user == task.assigned_to
        is_in_students = task.assigned_students.filter(id=request.user.id).exists()
        is_project_member = task.project.projectmember_set.filter(user=request.user).exists()

        if is_creator or is_assigned_to or is_in_students or is_project_member:
            return True
        
        logger.warning(
            f"Access denied for user {request.user.username} to task {task.id}. "
            f"Creator: {is_creator}, Assigned: {is_assigned_to}, In Students: {is_in_students}, Project Member: {is_project_member}"
        )
        return False
    
    def has_object_permission(self, request, view, obj):
        """
        Se ejecuta para acciones de detalle sobre un objeto existente.
        """
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR']:
            return True
        
        task = obj.task
        
        is_creator = request.user == task.created_by
        is_assigned_to = request.user == task.assigned_to
        is_in_students = task.assigned_students.filter(id=request.user.id).exists()
        is_project_member = task.project.projectmember_set.filter(user=request.user).exists()

        if is_creator or is_assigned_to or is_in_students or is_project_member:
            return True
            
        logger.warning(
            f"Object access denied for user {request.user.username} to task {task.id}. "
            f"Creator: {is_creator}, Assigned: {is_assigned_to}, In Students: {is_in_students}, Project Member: {is_project_member}"
        )
        return False