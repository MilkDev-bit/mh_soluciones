import os
from django.conf import settings
from django.utils.text import slugify
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
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
        try:
            stored_credentials = GoogleApiCredentials.objects.get(user=self.user)
            self.credentials = Credentials(
                token=stored_credentials.access_token,
                refresh_token=stored_credentials.refresh_token,
                token_uri=stored_credentials.token_uri,
                client_id=stored_credentials.client_id,
                client_secret=stored_credentials.client_secret,
                scopes=stored_credentials.scopes.split(' ')
            )
            self.service = build('drive', 'v3', credentials=self.credentials)
            if self.credentials and self.credentials.expired and self.credentials.refresh_token:
                from google.auth.transport.requests import Request
                self.credentials.refresh(Request())
                stored_credentials.access_token = self.credentials.token
                stored_credentials.save()
        except GoogleApiCredentials.DoesNotExist:
            print(f"El usuario {self.user.username} no ha vinculado su cuenta de Google.")
        except Exception as e:
            print(f"Error al inicializar el servicio de Google Drive: {e}")

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
            response = self.service.files().list(q=query, spaces='drive', fields='files(id)').execute()
            files = response.get('files', [])
            if files:
                return files[0].get('id')
            else:
                file_metadata = {'name': folder_name, 'mimeType': 'application/vnd.google-apps.folder'}
                if parent_id:
                    file_metadata['parents'] = [parent_id]
                folder = self.service.files().create(body=file_metadata, fields='id').execute()
                return folder.get('id')
        except HttpError as error:
            print(f"Ocurrió un error al buscar o crear la carpeta '{folder_name}': {error}")
            raise

    def upload_document(self, document_instance):
        """
        Sube un archivo a Google Drive replicando la nueva estructura de carpetas y nomenclatura.
        """
        if not self.service or not document_instance.file:
            print("Servicio no disponible o el documento no tiene un archivo físico.")
            return None

        try:
            date = document_instance.created_at
            current_year = date.strftime('%Y')
            active_statuses = ['PLANNING', 'IN_PROGRESS']
            project_status_folder = "Proyectos Activos" if document_instance.project.status in active_statuses else "Proyectos Inactivos"
            project_name = slugify(document_instance.project.name)
            folder_type = document_instance.folder_type

            year1_id = self._get_or_create_folder(current_year, parent_id=settings.GOOGLE_DRIVE_ROOT_FOLDER_ID)
            status_id = self._get_or_create_folder(project_status_folder, parent_id=year1_id)
            project_id = self._get_or_create_folder(project_name, parent_id=status_id)
            year2_id = self._get_or_create_folder(current_year, parent_id=project_id)
            final_parent_folder_id = self._get_or_create_folder(folder_type, parent_id=year2_id)

            task_title = slugify(document_instance.task.title)
            responsible_name = "sin-asignar"
            if document_instance.task and document_instance.task.assigned_to:
                responsible_name = slugify(document_instance.task.assigned_to.get_full_name() or document_instance.task.assigned_to.username)
            date_str = date.strftime('%d-%m-%y')
            _ , extension = os.path.splitext(document_instance.file.name)
            new_filename = f"{task_title}_{responsible_name}_{date_str}{extension}"

            file_metadata = {
                'name': new_filename,
                'parents': [final_parent_folder_id]
            }
            media = MediaFileUpload(document_instance.file.path)
            
            uploaded_file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, webViewLink'
            ).execute()

            return uploaded_file
            
        except Exception as e:
            print(f"Ocurrió un error al subir el archivo a Google Drive: {e}")
            return None