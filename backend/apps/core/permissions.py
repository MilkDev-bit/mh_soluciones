"""
Centralized permission classes for role-based access control (RBAC).

Role hierarchy:
- SUPERADMIN: Full access to everything including user management
- ADMIN: All access except user creation/modification
- DIRECTOR: Can assign members, create projects, view dashboards & Drive folders
- PROFESSOR: Can view assigned projects, comment, share, create channels, assign tasks, grade submissions
- CEO: Can view all dashboards & Drive folders (even non-assigned projects)
- STUDENT: Can only view and submit assigned tasks
- CLIENT: Can view specific project information
- RH: Human resources management
"""

from rest_framework import permissions


# Role constants
ROLE_SUPERADMIN = 'SUPERADMIN'
ROLE_ADMIN = 'ADMIN'
ROLE_DIRECTOR = 'DIRECTOR'
ROLE_PROFESSOR = 'PROFESSOR'
ROLE_CEO = 'CEO'
ROLE_STUDENT = 'STUDENT'
ROLE_CLIENT = 'CLIENT'
ROLE_RH = 'RH'

# Role groups
ADMIN_ROLES = (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_CEO, ROLE_RH)
MANAGEMENT_ROLES = (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_DIRECTOR, ROLE_CEO, ROLE_RH)
TEACHER_ROLES = ADMIN_ROLES + (ROLE_PROFESSOR, ROLE_DIRECTOR)
EDITOR_ROLES = TEACHER_ROLES  # Can create/edit content


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission class that only allows access to SUPERADMIN users.
    Used for critical operations like user management.
    """
    message = "Solo los super administradores tienen acceso a este recurso."
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role == ROLE_SUPERADMIN
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Permission class that allows:
    - Read access to authenticated users
    - Write access only to admin roles
    """
    message = "Solo los administradores pueden modificar este recurso."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Read permissions for all authenticated users
        if request.method in permissions.SAFE_METHODS:
            return True
        
        # Write permissions only for admin roles
        return request.user.role in ADMIN_ROLES


class IsAdminRole(permissions.BasePermission):
    """
    Permission class that only allows access to admin role users.
    Includes: SUPERADMIN, ADMIN, CEO, RH
    """
    message = "Solo los administradores tienen acceso a este recurso."
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in ADMIN_ROLES
        )


class IsManagementRole(permissions.BasePermission):
    """
    Permission class that allows access to management roles.
    Includes: SUPERADMIN, ADMIN, DIRECTOR, CEO, RH
    """
    message = "Solo el personal de gestión tiene acceso a este recurso."
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in MANAGEMENT_ROLES
        )


class IsTeacherRole(permissions.BasePermission):
    """
    Permission class that allows access to teacher roles.
    Includes: SUPERADMIN, ADMIN, PROFESSOR, DIRECTOR, CEO, RH
    """
    message = "Solo el personal docente tiene acceso a este recurso."
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in TEACHER_ROLES
        )


class IsEditorRole(permissions.BasePermission):
    """
    Permission class that allows access to roles that can create/edit content.
    Includes: SUPERADMIN, ADMIN, PROFESSOR, DIRECTOR, CEO, RH
    """
    message = "Solo el personal autorizado puede crear o editar contenido."
    
    def has_permission(self, request, view):
        return (
            request.user and 
            request.user.is_authenticated and 
            request.user.role in EDITOR_ROLES
        )


class CanViewDashboards(permissions.BasePermission):
    """
    Permission class for dashboard viewing.
    - CEO: Can view all dashboards
    - DIRECTOR: Can view dashboards of assigned projects
    - Others: Based on project membership
    """
    message = "No tienes permisos para ver este dashboard."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # CEO can view all dashboards
        if request.user.role == ROLE_CEO:
            return True
        
        # DIRECTOR and admin roles can view dashboards
        if request.user.role in (ROLE_DIRECTOR, ROLE_SUPERADMIN, ROLE_ADMIN):
            return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions for specific project dashboards"""
        # CEO can view all
        if request.user.role == ROLE_CEO:
            return True
        
        # Admin roles can view all
        if request.user.role in ADMIN_ROLES:
            return True
        
        # DIRECTOR can view if assigned to project
        if request.user.role == ROLE_DIRECTOR:
            # Check if user is a member of the project
            if hasattr(obj, 'members'):
                return obj.members.filter(id=request.user.id).exists()
            if hasattr(obj, 'project') and hasattr(obj.project, 'members'):
                return obj.project.members.filter(id=request.user.id).exists()
        
        return False


class CanManageUsers(permissions.BasePermission):
    """
    Permission class for user management.
    Only SUPERADMIN can create/modify/delete users.
    ADMIN can view users but not modify.
    """
    message = "Solo los super administradores pueden gestionar usuarios."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SUPERADMIN can do everything
        if request.user.role == ROLE_SUPERADMIN:
            return True
        
        # ADMIN can only read
        if request.user.role == ROLE_ADMIN and request.method in permissions.SAFE_METHODS:
            return True
        
        return False


class CanManageProjects(permissions.BasePermission):
    """
    Permission class for project management.
    - DIRECTOR: Can create projects and assign members
    - ADMIN: Full access
    - Others: Based on project membership
    """
    message = "No tienes permisos para gestionar proyectos."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admin roles have full access
        if request.user.role in ADMIN_ROLES:
            return True
        
        # DIRECTOR can create and manage projects
        if request.user.role == ROLE_DIRECTOR:
            return True
        
        # PROFESSOR can view projects they're assigned to
        if request.user.role == ROLE_PROFESSOR and request.method in permissions.SAFE_METHODS:
            return True
        
        return False
    
    def has_object_permission(self, request, view, obj):
        """Check object-level permissions for specific projects"""
        # Admin roles have full access
        if request.user.role in ADMIN_ROLES:
            return True
        
        # DIRECTOR can manage if they're a member
        if request.user.role == ROLE_DIRECTOR:
            if hasattr(obj, 'members'):
                return obj.members.filter(id=request.user.id).exists()
        
        # PROFESSOR can view if they're a member
        if request.user.role == ROLE_PROFESSOR:
            if request.method in permissions.SAFE_METHODS:
                if hasattr(obj, 'members'):
                    return obj.members.filter(id=request.user.id).exists()
        
        return False


class CanManageTasks(permissions.BasePermission):
    """
    Permission class for task management.
    - PROFESSOR: Can create and assign tasks, grade submissions
    - DIRECTOR: Can create and manage tasks in their projects
    - STUDENT: Can only view assigned tasks
    """
    message = "No tienes permisos para gestionar tareas."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Teacher roles can create and manage tasks
        if request.user.role in TEACHER_ROLES:
            return True
        
        # STUDENT can only read their assigned tasks
        if request.user.role == ROLE_STUDENT and request.method in permissions.SAFE_METHODS:
            return True
        
        return False


class CanViewAllDriveFolders(permissions.BasePermission):
    """
    Permission class for viewing all Drive folders.
    - CEO: Can view all Drive folders
    - DIRECTOR: Can view Drive folders of assigned projects
    """
    message = "No tienes permisos para ver todas las carpetas de Drive."
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # CEO can view all Drive folders
        if request.user.role == ROLE_CEO:
            return True
        
        # DIRECTOR can view Drive folders of assigned projects
        if request.user.role == ROLE_DIRECTOR:
            return True
        
        # Admin roles can view all
        if request.user.role in ADMIN_ROLES:
            return True
        
        return False


def check_role_permission(user, required_roles):
    """
    Helper function to check if a user has one of the required roles.
    
    Args:
        user: The user object
        required_roles: A tuple or list of role strings
    
    Returns:
        bool: True if user has one of the required roles, False otherwise
    """
    if not user or not user.is_authenticated:
        return False
    
    return user.role in required_roles


def get_role_display(role):
    """
    Helper function to get a human-readable role name.
    
    Args:
        role: The role string
    
    Returns:
        str: Human-readable role name
    """
    role_names = {
        ROLE_SUPERADMIN: 'Super Administrador',
        ROLE_ADMIN: 'Administrador',
        ROLE_DIRECTOR: 'Director',
        ROLE_PROFESSOR: 'Profesor',
        ROLE_CEO: 'CEO',
        ROLE_STUDENT: 'Estudiante',
        ROLE_CLIENT: 'Cliente',
        ROLE_RH: 'Recursos Humanos'
    }
    return role_names.get(role, role)
