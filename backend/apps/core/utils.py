import os
import secrets
import string
from django.utils.text import slugify

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

    current_year = instance.created_at.strftime('%Y') if hasattr(instance, 'created_at') and instance.created_at else "SIN_FECHA"

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