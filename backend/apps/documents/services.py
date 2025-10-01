import os
import io
from django.conf import settings
from django.utils.text import slugify
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from googleapiclient.errors import HttpError
from google.auth.transport.requests import Request
from apps.authentication.models import GoogleApiCredentials

class GoogleDriveService:
    """
    Servicio para interactuar con la API de Google Drive usando
    las credenciales guardadas del usuario.
    """
    def __init__(self, user):
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
                self.credentials.refresh(Request())
                stored_credentials.access_token = self.credentials.token
                stored_credentials.save()
            
            self.service = build('drive', 'v3', credentials=self.credentials)
            print(f"✅ Servicio de Google Drive inicializado para {self.user.username}")
            
        except GoogleApiCredentials.DoesNotExist:
            raise Exception(f"El usuario {self.user.username} no ha vinculado su cuenta de Google.")
        except Exception as e:
            print(f"❌ Error al inicializar el servicio de Google Drive: {e}")
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
                print(f"✅ Carpeta encontrada: {folder_name} (ID: {files[0].get('id')})")
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
                print(f"✅ Carpeta creada: {folder_name} (ID: {folder.get('id')})")
                return folder.get('id')
                
        except HttpError as error:
            print(f"❌ Error al buscar/crear carpeta '{folder_name}': {error}")
            raise

    def upload_document(self, document_instance):
        """
        Sube un archivo a Google Drive usando la instancia del documento.
        """
        if not self.service:
            raise ConnectionError("Servicio de Google Drive no inicializado.")

        if not document_instance.file:
            print("❌ El documento no tiene un archivo físico.")
            return None

        try:
            date = document_instance.created_at
            current_year = date.strftime('%Y')
            
            if document_instance.project:
                active_statuses = ['PLANNING', 'IN_PROGRESS']
                project_status_folder = "Proyectos Activos" if document_instance.project.status in active_statuses else "Proyectos Inactivos"
                project_name = slugify(document_instance.project.name)
                folder_type = document_instance._get_folder_type_for_drive()

                print(f"📁 Creando estructura de carpetas para proyecto: {document_instance.project.name}")

                year1_id = self._get_or_create_folder(current_year, parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)
                status_id = self._get_or_create_folder(project_status_folder, parent_id=year1_id)
                project_id = self._get_or_create_folder(project_name, parent_id=status_id)
                year2_id = self._get_or_create_folder(current_year, parent_id=project_id)
                final_parent_folder_id = self._get_or_create_folder(folder_type, parent_id=year2_id)

                if document_instance.task:
                    task_title = slugify(document_instance.task.title)
                    responsible_name = "sin-asignar"
                    if document_instance.task.assigned_to:
                        responsible_name = slugify(
                            document_instance.task.assigned_to.get_full_name() or 
                            document_instance.task.assigned_to.username
                        )
                else:
                    task_title = "sin-tarea"
                    responsible_name = slugify(document_instance.uploaded_by.get_full_name() or document_instance.uploaded_by.username)
                
            else:
                folder_type = document_instance._get_folder_type_for_drive()
                print(f"📁 Creando estructura simple para documento sin proyecto")

                year_id = self._get_or_create_folder(current_year, parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)
                final_parent_folder_id = self._get_or_create_folder(folder_type, parent_id=year_id)
                
                task_title = "general"
                responsible_name = slugify(document_instance.uploaded_by.get_full_name() or document_instance.uploaded_by.username)

            date_str = date.strftime('%d-%m-%y')
            filename, extension = os.path.splitext(document_instance.file.name)
            new_filename = f"{task_title}_{responsible_name}_{date_str}{extension}"

            print(f"📤 Subiendo archivo: {new_filename}")

            file_metadata = {
                'name': new_filename,
                'parents': [final_parent_folder_id]
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

            print(f"✅ Archivo subido exitosamente: {uploaded_file.get('name')}")
            print(f"🔗 Enlace: {uploaded_file.get('webViewLink')}")

            return uploaded_file
            
        except Exception as e:
            print(f"❌ Error al subir el archivo a Google Drive: {e}")
            import traceback
            traceback.print_exc()
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
            print(f"📤 Subiendo archivo: {file_name}")

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

            print(f"✅ Archivo subido exitosamente: {uploaded_file.get('name')}")
            print(f"🔗 Enlace: {uploaded_file.get('webViewLink')}")

            return uploaded_file
            
        except Exception as e:
            print(f"❌ Error al subir el archivo a Google Drive: {e}")
            import traceback
            traceback.print_exc()
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