import io
import logging
import os

from django.conf import settings
from django.utils.text import slugify
from google.auth.transport.requests import Request
from google.auth.exceptions import RefreshError
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload

from apps.authentication.models import GoogleApiCredentials

logger = logging.getLogger(__name__)


class GoogleDriveService:
    """
    Servicio para interactuar con la API de Google Drive usando
    las credenciales guardadas del usuario o credenciales institucionales.
    """
    def __init__(self, user=None, use_institutional=False):
        """
        Inicializa el servicio de Google Drive.
        
        Args:
            user: Usuario para obtener credenciales (opcional si use_institutional=True)
            use_institutional: Si True, usa credenciales del admin institucional
        """
        if use_institutional:
            # Usar credenciales del usuario admin institucional
            admin_user_id = getattr(settings, 'GOOGLE_DRIVE_ADMIN_USER_ID', None)
            if not admin_user_id:
                raise ValueError("GOOGLE_DRIVE_ADMIN_USER_ID no está configurado en settings")
            
            from apps.authentication.models import CustomUser
            try:
                self.user = CustomUser.objects.get(id=admin_user_id)
                logger.info(f"Usando credenciales institucionales del usuario: {self.user.username}")
            except CustomUser.DoesNotExist:
                raise ValueError(f"Usuario admin con ID {admin_user_id} no encontrado")
        else:
            if not user:
                raise ValueError("Se requiere un usuario si use_institutional=False")
            self.user = user
            
        self.credentials = None
        self.service = None
        self._initialize_service()

    def _initialize_service(self):
        """Inicializa el servicio de Google Drive"""
        try:
            stored_credentials = GoogleApiCredentials.objects.get(user=self.user)
            self.credentials = Credentials(
                token=stored_credentials.access_token,
                refresh_token=stored_credentials.refresh_token,
                token_uri=stored_credentials.token_uri or "https://oauth2.googleapis.com/token",
                client_id=stored_credentials.client_id,
                client_secret=stored_credentials.client_secret,
                scopes=stored_credentials.scopes.split(' ') if stored_credentials.scopes else [
                    'https://www.googleapis.com/auth/drive.file'
                ]
            )
            
            if self.credentials.expired and self.credentials.refresh_token:
                try:
                    logger.info(f"Refrescando credenciales expiradas para usuario {self.user.username}")
                    self.credentials.refresh(Request())
                    stored_credentials.access_token = self.credentials.token
                    stored_credentials.save()
                    logger.info(f"Credenciales refrescadas exitosamente para {self.user.username}")
                except RefreshError as e:
                    logger.exception(
                        f"Error al refrescar credenciales de Google Drive para usuario {self.user.username}: {e}"
                    )
                    # Re-raise the original exception for proper error handling
                    raise
            
            self.service = build('drive', 'v3', credentials=self.credentials)
            logger.info(f"Servicio de Google Drive inicializado para {self.user.username}")
            
        except GoogleApiCredentials.DoesNotExist:
            logger.error(f"El usuario {self.user.username} no tiene credenciales de Google vinculadas")
            raise Exception(f"El usuario {self.user.username} no ha vinculado su cuenta de Google.")
        except RefreshError:
            # Re-raise RefreshError as-is (already logged above)
            raise
        except Exception as e:
            logger.exception(
                f"Error inesperado al inicializar el servicio de Google Drive para {self.user.username}: {e}"
            )
            raise

    def _get_or_create_folder(self, folder_name, parent_id=None):
        """
        Busca una carpeta por nombre dentro de una carpeta padre.
        Si no existe, la crea. Devuelve el ID de la carpeta.
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        try:
            response = self.service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
            files = response.get('files', [])
            if files:
                logger.debug(f"Carpeta encontrada: {folder_name} (ID: {files[0].get('id')})")
                return files[0].get('id')
            else:
                file_metadata = {
                    'name': folder_name, 
                    'mimeType': 'application/vnd.google-apps.folder'
                }
                if parent_id:
                    file_metadata['parents'] = [parent_id]
                
                folder = self.service.files().create(
                    body=file_metadata, 
                    fields='id, name'
                ).execute()
                logger.debug(f"Carpeta creada: {folder_name} (ID: {folder.get('id')})")
                return folder.get('id')
                
        except HttpError as error:
            logger.error(f"Error al buscar/crear carpeta '{folder_name}': {error}")
            raise

    def upload_document(self, document_instance):
        """
        Sube un archivo a Google Drive usando la nueva estructura institucional.
        Nueva estructura: AÑO/PROYECTO/NOMBRE_TAREA/USUARIO/archivo.ext
        - AÑO: Carpeta raíz por año (2025, 2024, etc.)
        - PROYECTO: Carpeta del proyecto
        - NOMBRE_TAREA: Carpeta de la tarea (si hay tarea asociada, sino se omite este nivel)
        - USUARIO: Carpeta del usuario que sube el archivo
        - Archivos se guardan directamente sin subcarpetas de versión
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        if not document_instance.file:
            logger.warning("El documento no tiene un archivo físico.")
            return None

        try:
            date = document_instance.created_at
            current_year = date.strftime('%Y')
            
            # Level 1 - Year folder (AÑO)
            year_id = self._get_or_create_folder(
                current_year, 
                parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
            )
            
            # Level 2 - Project folder (PROYECTO)
            if document_instance.project:
                project_name = document_instance.project.name
                project_id = self._get_or_create_folder(project_name, parent_id=year_id)
            else:
                # Si no hay proyecto, usar carpeta "General"
                project_id = self._get_or_create_folder("General", parent_id=year_id)
            
            # Level 3 - Task name folder (NOMBRE_TAREA) - only if task exists
            task_name = None
            task_id = None
            if document_instance.task:
                task_name = document_instance.task.title
                task_id = self._get_or_create_folder(task_name, parent_id=project_id)
                parent_for_user = task_id
            else:
                # If no task, user folder goes directly under project
                parent_for_user = project_id
            
            # Level 4 - User folder (USUARIO)
            if document_instance.uploaded_by:
                user_name = document_instance.uploaded_by.get_full_name() or document_instance.uploaded_by.username
                user_id = self._get_or_create_folder(user_name, parent_id=parent_for_user)
            else:
                # Fallback: use "Usuario Desconocido" if no user
                user_name = "Usuario Desconocido"
                user_id = self._get_or_create_folder(user_name, parent_id=parent_for_user)
            
            # Create filename - keep original name, no version subfolder
            filename = document_instance.file.name
            
            # Build path for logging
            project_name = document_instance.project.name if document_instance.project else 'General'
            task_name = document_instance.task.title if document_instance.task else ''
            path_parts = [current_year, project_name]
            if task_name:
                path_parts.append(task_name)
            path_parts.append(user_name)
            
            logger.info(f"Subiendo archivo: {filename} a estructura {'/'.join(path_parts)}")

            file_metadata = {
                'name': filename,
                'parents': [user_id]  # Files go directly in user folder
            }

            if hasattr(document_instance.file, 'path') and os.path.exists(document_instance.file.path):
                media = MediaFileUpload(document_instance.file.path, resumable=True)
            else:
                file_content = document_instance.file.read()
                file_io = io.BytesIO(file_content)
                media = MediaIoBaseUpload(
                    file_io, 
                    mimetype=document_instance.file_type or 'application/octet-stream', 
                    resumable=True
                )

            uploaded_file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, mimeType, size'
            ).execute()

            logger.info(f"Archivo subido exitosamente: {uploaded_file.get('name')} - {uploaded_file.get('webViewLink')}")

            # Add parent folder information to the result
            # The folder that appears directly under PROJECT is either:
            # - The TASK folder (if task exists), or
            # - The USER folder (if no task exists)
            if document_instance.task:
                uploaded_file['parent_folder_id'] = task_id
                uploaded_file['parent_folder_name'] = task_name
            else:
                # No task - the user folder is directly under project
                uploaded_file['parent_folder_id'] = user_id
                uploaded_file['parent_folder_name'] = user_name

            return uploaded_file
            
        except RefreshError as e:
            logger.exception(f"Error al refrescar credenciales al subir archivo: {e}")
            raise
        except HttpError as e:
            logger.exception(f"Error HTTP al subir archivo a Google Drive: código={e.resp.status}")
            raise
        except Exception as e:
            logger.exception(f"Error inesperado al subir el archivo a Google Drive: {e}")
            return None
        
    def upload_file(self, file_name, file_content, folder_id, mime_type='text/plain'):
        """
        Sube un archivo directamente a Google Drive.
        
        Args:
            file_name (str): Nombre del archivo
            file_content (bytes): Contenido del archivo en bytes
            folder_id (str): ID de la carpeta destino
            mime_type (str): Tipo MIME del archivo
        
        Returns:
            dict: Información del archivo subido
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        try:
            logger.info(f"Subiendo archivo: {file_name}")

            file_metadata = {
                'name': file_name,
                'parents': [folder_id]
            }

            file_stream = io.BytesIO(file_content)
            media = MediaIoBaseUpload(
                file_stream,
                mimetype=mime_type,
                resumable=True
            )

            uploaded_file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink, mimeType, size'
            ).execute()

            logger.info(f"Archivo subido exitosamente: {uploaded_file.get('name')} - {uploaded_file.get('webViewLink')}")

            return uploaded_file
            
        except Exception as e:
            logger.exception(f"Error al subir el archivo a Google Drive: {e}")
            return None

    def test_connection(self):
        """Prueba la conexión con Google Drive"""
        if not self.service:
            return {'success': False, 'error': 'Servicio no inicializado'}
        
        try:
            results = self.service.files().list(
                pageSize=1,
                fields="files(id, name)"
            ).execute()
            
            return {
                'success': True,
                'message': f'Conexión exitosa. {len(results.get("files", []))} archivos encontrados.'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def list_folders_for_project(self, project_id, year=None):
        """
        Lista las carpetas reales existentes en Google Drive para un proyecto específico.
        
        Args:
            project_id: ID del proyecto
            year: Año (opcional, si no se proporciona usa el año actual)
        
        Returns:
            list: Lista de diccionarios con información de las carpetas
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")
        
        try:
            from apps.projects.models import Project
            from datetime import datetime
            
            # Get project
            try:
                project = Project.objects.get(id=project_id)
                logger.info(f"[DRIVE DEBUG] Listando carpetas de Google Drive para proyecto ID={project_id}, nombre='{project.name}'")
            except Project.DoesNotExist:
                logger.error(f"[DRIVE DEBUG] Proyecto con ID {project_id} no encontrado en la base de datos")
                return []
            
            # Get year folder
            if not year:
                year = datetime.now().strftime('%Y')
            
            logger.info(f"[DRIVE DEBUG] Obteniendo carpeta de año '{year}' en Google Drive")
            logger.info(f"[DRIVE DEBUG] Root folder ID: {settings.GOOGLE_DRIVE_ROOT_FOLDER_ID}")
            year_id = self._get_or_create_folder(
                year, 
                parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
            )
            logger.info(f"[DRIVE DEBUG] Carpeta de año '{year}' obtenida: folder_id={year_id}")
            
            # Get project folder
            project_name = project.name
            logger.info(f"[DRIVE DEBUG] Obteniendo carpeta de proyecto '{project_name}' en Google Drive (parent: año '{year}')")
            project_folder_id = self._get_or_create_folder(project_name, parent_id=year_id)
            logger.info(f"[DRIVE DEBUG] Carpeta de proyecto obtenida: folder_id={project_folder_id} para project_id={project_id}")
            
            # List all folders (not files) within the project folder
            query = f"mimeType='application/vnd.google-apps.folder' and '{project_folder_id}' in parents and trashed=false"
            
            logger.info(f"[DRIVE DEBUG] Ejecutando consulta a Google Drive API con query: {query}")
            response = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, createdTime, modifiedTime)',
                orderBy='name'
            ).execute()
            
            # Log raw response for debugging
            logger.info(f"[DRIVE DEBUG] Respuesta cruda de Google Drive API: {response}")
            
            folders = response.get('files', [])
            
            logger.info(f"[DRIVE DEBUG] Encontradas {len(folders)} subcarpetas para el proyecto '{project_name}' (ID={project_id})")
            
            # If no subfolders found, include the project folder itself as an option
            if len(folders) == 0:
                logger.warning(
                    f"[DRIVE DEBUG] No se encontraron subcarpetas en project_id={project_id}, folder_id={project_folder_id}. "
                    f"Se retornará la carpeta del proyecto como opción de subida."
                )
                # Return the project folder itself so users can upload there
                folders = [{
                    'id': project_folder_id,
                    'name': project_name,
                    'createdTime': None,
                    'modifiedTime': None,
                    'isProjectRoot': True  # Flag to identify this is the project root
                }]
                logger.info(f"[DRIVE DEBUG] Retornando carpeta raíz del proyecto: {folders}")
            else:
                # Log each subfolder found
                for folder in folders:
                    logger.info(f"[DRIVE DEBUG] Subcarpeta encontrada: {folder.get('name')} (ID: {folder.get('id')})")
            
            return folders
            
        except HttpError as e:
            logger.exception(
                f"[DRIVE DEBUG] Error HTTP al acceder a Google Drive para project_id={project_id}: código={e.resp.status}, mensaje={e}"
            )
            raise
        except Exception as e:
            logger.exception(
                f"[DRIVE DEBUG] Error inesperado al listar carpetas para proyecto {project_id}: {e}"
            )
            return []