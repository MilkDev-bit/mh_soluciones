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
        Si existen múltiples carpetas con el mismo nombre, retorna la más antigua (determinista).
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        query = f"mimeType='application/vnd.google-apps.folder' and name='{folder_name}' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        try:
            response = self.service.files().list(
                q=query,
                spaces='drive',
                fields='files(id, name, createdTime)',
                orderBy='createdTime'
            ).execute()
            files = response.get('files', [])
            if files:
                if len(files) > 1:
                    logger.warning(
                        f"Se encontraron {len(files)} carpetas duplicadas con nombre '{folder_name}' "
                        f"(parent_id={parent_id}). Usando la más antigua: {files[0].get('id')}"
                    )
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

    def upload_document(self, document_instance, target_folder_id=None):
        """
        Sube un archivo a Google Drive usando la nueva estructura institucional o una carpeta específica.
        
        Si se proporciona target_folder_id, el archivo se sube directamente a esa carpeta.
        
        Si NO se proporciona target_folder_id, se usa la estructura automática:
        Nueva estructura: AÑO/PROYECTO/NOMBRE_TAREA/USUARIO/archivo.ext
        - AÑO: Carpeta raíz por año (2025, 2024, etc.)
        - PROYECTO: Carpeta del proyecto
        - NOMBRE_TAREA: Carpeta de la tarea (si hay tarea asociada, sino se omite este nivel)
        - USUARIO: Carpeta del usuario que sube el archivo
        - Archivos se guardan directamente sin subcarpetas de versión
        
        Args:
            document_instance: Instancia del documento a subir
            target_folder_id (str, optional): ID de la carpeta destino en Google Drive.
                Si se proporciona, se sube directamente aquí ignorando la estructura automática.
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        if not document_instance.file:
            logger.warning("El documento no tiene un archivo físico.")
            return None

        try:
            # Determine target folder and build metadata
            if target_folder_id:
                # Upload directly to the specified folder
                logger.info(
                    f"Subiendo archivo a carpeta específica: {document_instance.file.name} "
                    f"a folder_id={target_folder_id}"
                )
                
                # Get folder name for logging and metadata
                try:
                    folder_metadata = self.service.files().get(
                        fileId=target_folder_id,
                        fields='id, name'
                    ).execute()
                    folder_name = folder_metadata.get('name', 'Carpeta Desconocida')
                except HttpError as e:
                    logger.error(f"Error al obtener metadata de carpeta {target_folder_id}: {e}")
                    folder_name = 'Carpeta Desconocida'
                
                parent_folder_id = target_folder_id
                parent_folder_name = folder_name
                file_upload_parent_id = target_folder_id  # Upload directly to selected folder
                filename = document_instance.file.name
                
                logger.info(
                    f"[UPLOAD] Archivo: {filename} -> Carpeta destino: '{parent_folder_name}' (ID: {parent_folder_id})"
                )
            else:
                # Use automatic folder structure
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
                task_folder_id = None
                if document_instance.task:
                    task_name = document_instance.task.title
                    task_folder_id = self._get_or_create_folder(task_name, parent_id=project_id)
                    parent_for_user = task_folder_id
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
                
                # File physically lives in user folder
                file_upload_parent_id = user_id
                
                # For filtering purposes, store the project-level subfolder ID:
                # - If task exists: task folder (direct child of project, shown in dropdown)
                # - If no task: user folder IS direct child of project
                if task_folder_id:
                    parent_folder_id = task_folder_id
                    parent_folder_name = task_name
                else:
                    parent_folder_id = user_id
                    parent_folder_name = user_name
                
                # Create filename - keep original name, no version subfolder
                filename = document_instance.file.name
                
                # Build path for logging
                project_name = document_instance.project.name if document_instance.project else 'General'
                task_name_log = document_instance.task.title if document_instance.task else ''
                path_parts = [current_year, project_name]
                if task_name_log:
                    path_parts.append(task_name_log)
                path_parts.append(user_name)
                
                logger.info(f"Subiendo archivo: {filename} a estructura {'/'.join(path_parts)}")


            # Upload file to Drive
            # file_upload_parent_id = actual Drive folder the file goes into
            # parent_folder_id = project-level subfolder stored in DB for filtering
            file_metadata = {
                'name': filename,
                'parents': [file_upload_parent_id]
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

            logger.info(
                f"[UPLOAD] Archivo subido exitosamente: {uploaded_file.get('name')} -> "
                f"Carpeta: '{parent_folder_name}' (ID: {parent_folder_id}) - "
                f"URL: {uploaded_file.get('webViewLink')}"
            )

            # Add parent folder information to the result
            uploaded_file['parent_folder_id'] = parent_folder_id
            uploaded_file['parent_folder_name'] = parent_folder_name

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

    def copy_file(self, source_file_id, new_name, folder_id):
        """
        Crea una copia congelada de un archivo/Google Doc en la carpeta especificada.

        La cuenta institucional debe tener al menos permiso de lectura sobre el archivo
        origen (el documento debe ser público o compartido con ella).

        Args:
            source_file_id (str): ID del archivo origen en Google Drive.
            new_name (str): Nombre que tendrá la copia.
            folder_id (str): ID de la carpeta destino donde se guardará la copia.

        Returns:
            dict | None: Metadata del archivo copiado (id, name, webViewLink) o None si falla.
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        try:
            body = {
                'name': new_name,
                'parents': [folder_id],
            }
            copied = self.service.files().copy(
                fileId=source_file_id,
                body=body,
                fields='id, name, webViewLink, mimeType',
            ).execute()
            logger.info(
                f"✅ [Drive Copy] Copia creada: {copied.get('name')} "
                f"(ID: {copied.get('id')}) -> {copied.get('webViewLink')}"
            )
            return copied
        except HttpError as e:
            logger.error(
                f"❌ [Drive Copy] HttpError al copiar archivo {source_file_id}: "
                f"status={e.resp.status} - {e}"
            )
            return None
        except Exception as e:
            logger.exception(f"❌ [Drive Copy] Error inesperado al copiar archivo {source_file_id}: {e}")
            return None

    @staticmethod
    def extract_file_id_from_url(url):
        """
        Extrae el ID de archivo de un URL de Google Drive o Google Docs/Sheets/Slides.

        Soporta formatos:
          - https://drive.google.com/file/d/<ID>/view
          - https://docs.google.com/document/d/<ID>/edit
          - https://docs.google.com/spreadsheets/d/<ID>/edit
          - https://docs.google.com/presentation/d/<ID>/edit
          - https://drive.google.com/open?id=<ID>

        Returns:
            str | None: El ID del archivo, o None si no se pudo extraer.
        """
        import re
        patterns = [
            r'/d/([a-zA-Z0-9_-]{25,})',
            r'[?&]id=([a-zA-Z0-9_-]{25,})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
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

    def _list_folders_recursive(self, parent_id, parent_name, depth=0, max_depth=6):
        """
        Lista recursivamente todas las carpetas dentro de un folder de Drive.

        Args:
            parent_id: ID del folder de Google Drive a explorar
            parent_name: Nombre del folder padre (para logging)
            depth: Nivel de profundidad actual (0 = hijos directos)
            max_depth: Profundidad máxima para evitar recursión infinita

        Returns:
            list: Lista plana de carpetas con campos 'depth' y 'parentId'
        """
        if depth > max_depth:
            logger.warning(f"[DRIVE DEBUG] Límite de profundidad ({max_depth}) alcanzado en carpeta '{parent_name}' (ID={parent_id})")
            return []

        query = (
            f"mimeType='application/vnd.google-apps.folder' "
            f"and '{parent_id}' in parents and trashed=false"
        )
        all_folders = []
        page_token = None

        while True:
            kwargs = {
                'q': query,
                'spaces': 'drive',
                'fields': 'nextPageToken, files(id, name, createdTime, modifiedTime)',
                'orderBy': 'name',
                'pageSize': 100,
            }
            if page_token:
                kwargs['pageToken'] = page_token

            response = self.service.files().list(**kwargs).execute()
            folders = response.get('files', [])

            for folder in folders:
                folder_entry = {
                    'id': folder.get('id'),
                    'name': folder.get('name'),
                    'createdTime': folder.get('createdTime'),
                    'modifiedTime': folder.get('modifiedTime'),
                    'depth': depth,
                    'parentId': parent_id,
                    'isProjectRoot': False,
                }
                all_folders.append(folder_entry)
                logger.info(
                    f"[DRIVE DEBUG] Carpeta nivel {depth}: '{folder.get('name')}' "
                    f"(ID={folder.get('id')}, padre='{parent_name}')"
                )

                # Recursivamente obtener subcarpetas de esta carpeta
                sub_folders = self._list_folders_recursive(
                    folder['id'], folder.get('name', ''), depth + 1, max_depth
                )
                all_folders.extend(sub_folders)

            page_token = response.get('nextPageToken')
            if not page_token:
                break

        return all_folders

    def list_folders_for_project(self, project_id, year=None):
        """
        Lista las carpetas reales existentes en Google Drive para un proyecto específico,
        incluyendo todas las subcarpetas de forma recursiva.
        
        Args:
            project_id: ID del proyecto
            year: Año (opcional, si no se proporciona usa el año actual)
        
        Returns:
            list: Lista plana de diccionarios con información de las carpetas,
                  incluyendo campos 'depth' y 'parentId' para representar la jerarquía
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
            
            # Obtener todas las carpetas de forma recursiva
            folders = self._list_folders_recursive(project_folder_id, project_name, depth=0)
            
            logger.info(f"[DRIVE DEBUG] Total de carpetas (todos los niveles) para proyecto '{project_name}': {len(folders)}")
            
            # If no subfolders found, include the project folder itself as an option
            if len(folders) == 0:
                logger.warning(
                    f"[DRIVE DEBUG] No se encontraron subcarpetas en project_id={project_id}, folder_id={project_folder_id}. "
                    f"Se retornará la carpeta del proyecto como opción de subida."
                )
                folders = [{
                    'id': project_folder_id,
                    'name': project_name,
                    'createdTime': None,
                    'modifiedTime': None,
                    'depth': 0,
                    'parentId': None,
                    'isProjectRoot': True,
                }]
                logger.info(f"[DRIVE DEBUG] Retornando carpeta raíz del proyecto: {folders}")
            
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