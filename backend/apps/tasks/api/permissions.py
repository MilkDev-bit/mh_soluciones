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
        task_pk = view.kwargs.get('task_pk')
        if not task_pk:
            logger.warning(
                f"CanInteractWithTask: task_pk ausente en kwargs. "
                f"view={view.__class__.__name__}, kwargs={view.kwargs}, action={getattr(view, 'action', '?')}"
            )
            return None

        try:
            return Task.objects.prefetch_related(
                'assigned_students',
                'project__projectmember_set'
            ).select_related(
                'created_by',
                'assigned_to',
                'project'
            ).get(pk=task_pk)
        except Task.DoesNotExist:
            logger.warning(
                f"CanInteractWithTask: Task {task_pk} no encontrada en BD "
                f"(Task.DoesNotExist). Puede ser race condition en creación o tarea eliminada."
            )
            return None
        except Exception as e:
            logger.error(
                f"CanInteractWithTask: Error inesperado al obtener Task {task_pk}: {type(e).__name__}: {e}"
            )
            return None

    def has_permission(self, request, view):
        """
        Se ejecuta para acciones de lista y creación.
        """
        if request.user.role in ['SUPERADMIN', 'ADMIN', 'CEO', 'PROFESSOR', 'DIRECTOR']:
            return True

        task = self._get_task(view)
        if not task:
            logger.warning(
                f"CanInteractWithTask: denegado a {request.user.username} (ID: {request.user.id}) "
                f"porque _get_task retornó None para task_pk={view.kwargs.get('task_pk')}. "
                f"action={getattr(view, 'action', '?')}"
            )
            return False

        # Verificamos tanto el creador, como el responsable directo (assigned_to)
        # o si el estudiante está en la lista de asignados (assigned_students)
        # O si es miembro del proyecto (siendo estudiante)
        # O si es el cliente asignado al proyecto (solo lectura)
        is_creator = request.user == task.created_by
        is_assigned_to = request.user == task.assigned_to
        is_in_students = task.assigned_students.filter(id=request.user.id).exists()
        is_project_member = task.project.projectmember_set.filter(user=request.user).exists()
        is_project_client = task.project.client_id == request.user.id

        if is_creator or is_assigned_to or is_in_students or is_project_member or is_project_client:
            return True
        
        logger.warning(
            f"Access denied for user {request.user.username} to task {task.id}. "
            f"Creator: {is_creator}, Assigned: {is_assigned_to}, In Students: {is_in_students}, "
            f"Project Member: {is_project_member}, Project Client: {is_project_client}"
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
        is_project_client = task.project.client_id == request.user.id

        if is_creator or is_assigned_to or is_in_students or is_project_member or is_project_client:
            return True
            
        logger.warning(
            f"Object access denied for user {request.user.username} to task {task.id}. "
            f"Creator: {is_creator}, Assigned: {is_assigned_to}, In Students: {is_in_students}, "
            f"Project Member: {is_project_member}, Project Client: {is_project_client}"
        )
        return False