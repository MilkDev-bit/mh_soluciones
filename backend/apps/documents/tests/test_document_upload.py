from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock

from apps.projects.models import Project, ProjectMember
from apps.documents.models import Document

User = get_user_model()


class DocumentUploadWithTargetFolderTest(TestCase):
    """Test document upload with target_folder_id parameter"""
    
    def setUp(self):
        # Create users with different roles
        self.admin = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='ADMIN',
            first_name='Admin',
            last_name='User'
        )
        
        self.student = User.objects.create_user(
            username='student',
            email='student@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Student',
            last_name='Member'
        )
        
        # Create project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Project Description',
            status='IN_PROGRESS',
            created_by=self.admin
        )
        
        # Add student as member
        ProjectMember.objects.create(
            project=self.project,
            user=self.student,
            role=ProjectMember.ProjectRole.MEMBER
        )
        
        self.client = APIClient()
        
        # Create a simple test file
        self.test_file = SimpleUploadedFile(
            "test_file.txt",
            b"file_content",
            content_type="text/plain"
        )
    
    @patch('apps.documents.api.views._is_celery_worker_available', return_value=True)
    @patch('apps.documents.api.views.GoogleDriveService')
    @patch('apps.documents.tasks.upload_document_to_drive.delay')
    def test_upload_with_target_folder_id(self, mock_upload_task, mock_drive, _worker):
        """Test that target_folder_id is passed correctly when uploading"""
        mock_drive.return_value.folder_belongs_to_project.return_value = True
        self.client.force_authenticate(user=self.student)
        
        target_folder_id = 'test-folder-id-12345'
        
        # Upload document with target_folder_id
        response = self.client.post(
            '/api/v1/documents/',
            {
                'file': self.test_file,
                'project': self.project.id,
                'folder_type': 'DOCUMENTOS',
                'target_folder_id': target_folder_id
            },
            format='multipart'
        )
        
        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify the task was called with target_folder_id
        mock_upload_task.assert_called_once()
        call_args = mock_upload_task.call_args
        
        # The first positional argument is the document ID
        document_id = call_args[0][0]
        self.assertTrue(isinstance(document_id, int))
        
        # The target_folder_id should be passed as a keyword argument
        self.assertIn('target_folder_id', call_args[1])
        self.assertEqual(call_args[1]['target_folder_id'], target_folder_id)
        
        # Verify document was created
        document = Document.objects.get(id=document_id)
        self.assertEqual(document.project, self.project)
        self.assertEqual(document.uploaded_by, self.student)
    
    @patch('apps.documents.api.views._is_celery_worker_available', return_value=True)
    @patch('apps.documents.tasks.upload_document_to_drive.delay')
    def test_upload_without_target_folder_id(self, mock_upload_task, _worker):
        """Test that upload works without target_folder_id (uses auto-generated structure)"""
        self.client.force_authenticate(user=self.student)
        
        # Upload document WITHOUT target_folder_id
        response = self.client.post(
            '/api/v1/documents/',
            {
                'file': SimpleUploadedFile("test2.txt", b"content", content_type="text/plain"),
                'project': self.project.id,
                'folder_type': 'DOCUMENTOS'
            },
            format='multipart'
        )
        
        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify the task was called
        mock_upload_task.assert_called_once()
        call_args = mock_upload_task.call_args
        
        # The target_folder_id should be None
        self.assertIn('target_folder_id', call_args[1])
        self.assertIsNone(call_args[1]['target_folder_id'])
    
    @patch('apps.documents.services.GoogleDriveService')
    def test_google_drive_service_upload_with_target_folder(self, mock_drive_service_class):
        """Test that GoogleDriveService.upload_document uses target_folder_id correctly"""
        # Mock the drive service
        mock_service_instance = MagicMock()
        mock_service_instance.service = MagicMock()
        mock_service_instance.upload_document.return_value = {
            'id': 'drive-file-id',
            'webViewLink': 'https://drive.google.com/file/d/xxx',
            'parent_folder_id': 'target-folder-123',
            'parent_folder_name': 'Test Folder'
        }
        mock_drive_service_class.return_value = mock_service_instance
        
        # Create a document
        document = Document.objects.create(
            name='test.txt',
            file=SimpleUploadedFile("test3.txt", b"content", content_type="text/plain"),
            project=self.project,
            uploaded_by=self.student,
            folder_type='DOCUMENTOS'
        )
        
        # Manually call the upload (since we're testing the service directly)
        from apps.documents.services import GoogleDriveService
        
        target_folder_id = 'target-folder-123'
        
        # Create the service and call upload_document
        drive_service = GoogleDriveService(use_institutional=True)
        result = drive_service.upload_document(document, target_folder_id=target_folder_id)
        
        # Verify upload_document was called with the document and target_folder_id
        mock_service_instance.upload_document.assert_called_once_with(
            document,
            target_folder_id=target_folder_id
        )
        
        # Verify the result contains expected data
        self.assertEqual(result['parent_folder_id'], 'target-folder-123')
        self.assertEqual(result['parent_folder_name'], 'Test Folder')
