import os
import secrets
import string
from django.utils.text import slugify
from rest_framework.response import Response
from rest_framework import status


def generate_random_password(length=12):
    """
    Genera una contraseña aleatoria y segura.
    """
    alphabet = string.ascii_letters + string.digits + string.punctuation
    while True:
        password = ''.join(secrets.choice(alphabet) for i in range(length))
        if (any(c.islower() for c in password) and
                any(c.isupper() for c in password) and
                any(c.isdigit() for c in password) and
                any(c in string.punctuation for c in password)):
            break
    return password


def get_document_upload_path(instance, filename):
    """
    Genera la ruta de subida y el nuevo nombre del archivo según la nueva estructura.
    Estructura: Año / Status Proyecto / Nombre Proyecto / Año / Tipo Carpeta / nombre_archivo.ext
    Nombre Archivo: titulodelatarea_nombredelresponsable_fecha_dd-mm-aa.ext
    """
    
    project = None
    task = None

    if hasattr(instance, 'task'):
        task = instance.task

    if hasattr(instance, 'project'):
        project = instance.project

    elif task and hasattr(task, 'project'):
        project = task.project

    from django.utils import timezone
    now = timezone.now()
    created_at = instance.created_at if hasattr(instance, 'created_at') and instance.created_at else now
    current_year = created_at.strftime('%Y')

    active_statuses = ['PLANNING', 'IN_PROGRESS']
    project_status_folder = "Proyectos Activos"
    
    if project and project.status not in active_statuses:
        project_status_folder = "Proyectos Inactivos"

    project_name = slugify(project.name) if project else "SIN_PROYECTO"
    
    folder_type = instance.folder_type if hasattr(instance, 'folder_type') else 'documentos'

    task_title = slugify(task.title) if task else "sin-tarea"

    responsible_name = "sin-asignar"
    if task and hasattr(task, 'assigned_to') and task.assigned_to:
        responsible_name = slugify(task.assigned_to.get_full_name() or task.assigned_to.username)

    date_str = instance.created_at.strftime('%d-%m-%y') if hasattr(instance, 'created_at') and instance.created_at else "sin-fecha"

    _ , extension = os.path.splitext(filename)

    new_filename = f"{task_title}_{responsible_name}_{date_str}{extension}"

    return os.path.join(
        current_year,
        project_status_folder,
        project_name,
        current_year,
        folder_type,
        new_filename
    )


# Standardized API Response Utilities

def success_response(data=None, message="", status_code=status.HTTP_200_OK):
    """
    Create a standardized success response.
    
    Args:
        data: The data to return (can be dict, list, or any serializable object)
        message: Optional success message
        status_code: HTTP status code (default: 200)
    
    Returns:
        Response: DRF Response object with standardized format
    
    Example:
        return success_response(
            data={'users': users_list},
            message="Usuarios obtenidos exitosamente"
        )
    """
    response_data = {
        'success': True,
        'data': data,
        'error': None,
        'message': message
    }
    return Response(response_data, status=status_code)


def error_response(message="", errors=None, status_code=status.HTTP_400_BAD_REQUEST):
    """
    Create a standardized error response.
    
    Args:
        message: Error message to display
        errors: Detailed error information (dict or list)
        status_code: HTTP status code (default: 400)
    
    Returns:
        Response: DRF Response object with standardized format
    
    Example:
        return error_response(
            message="Validación fallida",
            errors={'email': ['Este campo es requerido']},
            status_code=400
        )
    """
    response_data = {
        'success': False,
        'data': None,
        'error': errors or message,
        'message': message
    }
    return Response(response_data, status=status_code)


def created_response(data=None, message="Creado exitosamente"):
    """
    Create a standardized response for resource creation.
    
    Args:
        data: The created resource data
        message: Success message
    
    Returns:
        Response: DRF Response object with 201 status
    """
    return success_response(data, message, status.HTTP_201_CREATED)


def updated_response(data=None, message="Actualizado exitosamente"):
    """
    Create a standardized response for resource updates.
    
    Args:
        data: The updated resource data
        message: Success message
    
    Returns:
        Response: DRF Response object with 200 status
    """
    return success_response(data, message, status.HTTP_200_OK)


def deleted_response(message="Eliminado exitosamente"):
    """
    Create a standardized response for resource deletion.
    Uses 200 OK with response body for better client compatibility.
    
    Args:
        message: Success message
    
    Returns:
        Response: DRF Response object with 200 status
    """
    return success_response(
        data=None,
        message=message,
        status_code=status.HTTP_200_OK
    )


def validation_error_response(errors):
    """
    Create a standardized response for validation errors.
    
    Args:
        errors: Validation errors (typically from serializer.errors)
    
    Returns:
        Response: DRF Response object with 400 status
    """
    return error_response(
        message="Error de validación",
        errors=errors,
        status_code=status.HTTP_400_BAD_REQUEST
    )


def not_found_response(message="Recurso no encontrado"):
    """
    Create a standardized response for not found errors.
    
    Args:
        message: Error message
    
    Returns:
        Response: DRF Response object with 404 status
    """
    return error_response(message, status_code=status.HTTP_404_NOT_FOUND)


def forbidden_response(message="No tienes permisos para realizar esta acción"):
    """
    Create a standardized response for permission errors.
    
    Args:
        message: Error message
    
    Returns:
        Response: DRF Response object with 403 status
    """
    return error_response(message, status_code=status.HTTP_403_FORBIDDEN)


def unauthorized_response(message="No estás autenticado"):
    """
    Create a standardized response for authentication errors.
    
    Args:
        message: Error message
    
    Returns:
        Response: DRF Response object with 401 status
    """
    return error_response(message, status_code=status.HTTP_401_UNAUTHORIZED)


def server_error_response(message="Error interno del servidor"):
    """
    Create a standardized response for server errors.
    
    Args:
        message: Error message
    
    Returns:
        Response: DRF Response object with 500 status
    """
    return error_response(message, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)