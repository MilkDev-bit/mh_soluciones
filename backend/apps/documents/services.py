import io
import logging
import os
import re

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

# Los IDs de Drive solo usan letras, números, '-' y '_'. Validarlos evita que
# un ID manipulado inyecte condiciones en las consultas `q` de la API.
DRIVE_ID_RE = re.compile(r'^[A-Za-z0-9_-]{10,200}$')
# Profundidad máxima que se recorre hacia arriba buscando la raíz del proyecto.
MAX_FOLDER_DEPTH = 15


def is_valid_drive_id(value):
    return bool(value) and isinstance(value, str) and bool(DRIVE_ID_RE.match(value))



def oauth_client_for(stored_credentials):
    """
    (client_id, client_secret) para refrescar el token de Drive.

    [FIX seguridad] Antes se usaba la copia del client_secret guardada en la
    BD al conectar la cuenta. Si el secreto se rota en Google Cloud (p. ej.
    porque se filtró) y se desactiva el anterior, TODAS las subidas a Drive
    fallaban hasta volver a conectar cada cuenta. Ahora, si las credenciales
    son del mismo cliente OAuth configurado en el servidor, se usa el secreto
    actual de la variable de entorno GOOGLE_CLIENT_SECRET; rotarlo solo
    requiere actualizar esa variable.
    """
    current_id = getattr(settings, 'GOOGLE_CLIENT_ID', '') or ''
    current_secret = getattr(settings, 'GOOGLE_CLIENT_SECRET', '') or ''
    stored_id = stored_credentials.client_id or ''
    if current_id and current_secret and (not stored_id or stored_id == current_id):
        return current_id, current_secret
    return stored_id, stored_credentials.client_secret

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
            client_id, client_secret = oauth_client_for(stored_credentials)
            self.credentials = Credentials(
                token=stored_credentials.access_token,
                refresh_token=stored_credentials.refresh_token,
                token_uri=stored_credentials.token_uri or "https://oauth2.googleapis.com/token",
                client_id=client_id,
                client_secret=client_secret,
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

        # Escapar comillas/backslash del nombre (p. ej. "Casa D'Angelo") para no
        # romper ni alterar la consulta de Drive.
        safe_name = str(folder_name).replace('\\', '\\\\').replace("'", "\\'")
        query = f"mimeType='application/vnd.google-apps.folder' and name='{safe_name}' and trashed=false"
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
                parent_folder_id = target_folder_id
                parent_folder_name = target_folder_id  # ID como fallback; se actualiza abajo si es posible
                file_upload_parent_id = target_folder_id

                # Intentar obtener el nombre real de la carpeta (no crítico)
                try:
                    folder_metadata = self.service.files().get(
                        fileId=target_folder_id,
                        fields='id, name'
                    ).execute()
                    parent_folder_name = folder_metadata.get('name', target_folder_id)
                except Exception:
                    pass  # No crítico — se usa el ID como nombre de fallback

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

    def check_files_exist(self, drive_file_ids):
        """
        Verifica cuáles IDs de archivos de Drive siguen existiendo (no fueron eliminados).

        Hace consultas en lotes de hasta 100 IDs usando una query 'in' de Drive API.

        Args:
            drive_file_ids (list[str]): Lista de IDs de Drive a verificar.

        Returns:
            set[str]: Conjunto de IDs que SÍ existen en Drive (no eliminados, no en papelera).
        """
        if not self.service or not drive_file_ids:
            return set()

        existing_ids = set()
        batch_size = 100

        for i in range(0, len(drive_file_ids), batch_size):
            batch = drive_file_ids[i:i + batch_size]
            # Construir query: 'id = "x" or id = "y" ...'
            id_clauses = ' or '.join(f"'{fid}' in parents or id='{fid}'" for fid in batch)
            # Más eficiente: filtrar por ID directamente
            id_filter = ' or '.join(f"id='{fid}'" for fid in batch)
            query = f"({id_filter}) and trashed=false"

            try:
                response = self.service.files().list(
                    q=query,
                    spaces='drive',
                    fields='files(id)',
                    pageSize=len(batch),
                ).execute()
                for f in response.get('files', []):
                    existing_ids.add(f['id'])
            except Exception as e:
                logger.error(f"[DRIVE SYNC] Error verificando batch de IDs: {e}")
                # En caso de error de red, asumimos que existen (no borrar por error)
                existing_ids.update(batch)

        return existing_ids

    def folder_belongs_to_project(self, folder_id, project):
        """
        Indica si `folder_id` es la carpeta del proyecto o una subcarpeta suya.

        La estructura en Drive es RAÍZ / <año> / <nombre del proyecto> / ...
        Se recorren los padres de la carpeta hasta llegar a la raíz configurada;
        la carpeta que queda dos niveles debajo de la raíz debe llamarse como el
        proyecto. Cualquier otra ubicación (otro proyecto, fuera de la raíz, un
        archivo en lugar de carpeta, papelera) se rechaza.
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")
        root_id = settings.GOOGLE_DRIVE_ROOT_FOLDER_ID
        if not is_valid_drive_id(folder_id) or not root_id:
            return False

        # Al subir varios archivos a la misma carpeta se repite la consulta;
        # el resultado positivo se guarda unos minutos.
        from django.core.cache import cache
        cache_key = f'drive_folder_ok:{project.pk}:{folder_id}'
        if project.pk and cache.get(cache_key):
            return True
        ok = self._folder_chain_matches(folder_id, project, root_id)
        if ok and project.pk:
            cache.set(cache_key, True, 600)
        return ok

    def _folder_chain_matches(self, folder_id, project, root_id):
        chain = []  # [(id, name)] desde la carpeta destino hacia arriba
        current = folder_id
        for _ in range(MAX_FOLDER_DEPTH):
            if current == root_id:
                break
            meta = self.service.files().get(
                fileId=current,
                fields='id, name, mimeType, parents, trashed',
                supportsAllDrives=True,
            ).execute()
            if meta.get('trashed') or meta.get('mimeType') != 'application/vnd.google-apps.folder':
                return False
            chain.append((meta.get('id'), meta.get('name')))
            parents = meta.get('parents') or []
            if not parents:
                return False  # llegó a "Mi unidad" sin pasar por la raíz
            current = parents[0]
        else:
            return False

        # chain[-1] es la carpeta del año y chain[-2] la del proyecto
        if current != root_id or len(chain) < 2:
            return False
        return chain[-2][1] == project.name

    def list_direct_subfolders(self, parent_folder_id):
        """
        Lista los hijos directos (1 nivel) de una carpeta de Drive.

        Args:
            parent_folder_id: ID de la carpeta padre en Google Drive

        Returns:
            list: Lista de carpetas hijas directas
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")
        if not is_valid_drive_id(parent_folder_id):
            raise ValueError("ID de carpeta de Drive inválido.")

        query = (
            f"mimeType='application/vnd.google-apps.folder' "
            f"and '{parent_folder_id}' in parents and trashed=false"
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
            for folder in response.get('files', []):
                all_folders.append({
                    'id': folder.get('id'),
                    'name': folder.get('name'),
                    'createdTime': folder.get('createdTime'),
                    'modifiedTime': folder.get('modifiedTime'),
                    'parentId': parent_folder_id,
                    'isProjectRoot': False,
                })
            page_token = response.get('nextPageToken')
            if not page_token:
                break

        return all_folders

    def list_folders_for_project(self, project_id, year=None):
        """
        Lista los hijos directos de la carpeta raíz del proyecto en Google Drive.
        Usa un nivel único (no recursivo) para evitar timeouts.

        Args:
            project_id: ID del proyecto
            year: Año (opcional, si no se proporciona usa el año actual)

        Returns:
            list: Lista de diccionarios con las carpetas del primer nivel del proyecto.
                  Incluye 'parentId' con el ID de la carpeta raíz del proyecto.
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
            
            # Listar hijos directos del proyecto (1 nivel, sin recursión)
            folders = self.list_direct_subfolders(project_folder_id)
            logger.info(f"[DRIVE DEBUG] Hijos directos de '{project_name}': {len(folders)}")

            # Si no hay subcarpetas, devolver la carpeta raíz del proyecto
            if len(folders) == 0:
                logger.warning(
                    f"[DRIVE DEBUG] No se encontraron subcarpetas en project_id={project_id}, "
                    f"folder_id={project_folder_id}. Se retornará la carpeta raíz."
                )
                folders = [{
                    'id': project_folder_id,
                    'name': project_name,
                    'createdTime': None,
                    'modifiedTime': None,
                    'parentId': None,
                    'isProjectRoot': True,
                }]

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