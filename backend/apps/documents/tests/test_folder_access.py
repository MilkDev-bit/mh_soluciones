from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock

from apps.projects.models import Project, ProjectMember

User = get_user_model()


class FolderListAccessControlTest(TestCase):
    """Test role-based access control for folder listing endpoint"""
    
    def setUp(self):
        # Create users with different roles
        self.superadmin = User.objects.create_user(
            username='superadmin',
            email='superadmin@example.com',
            password='testpass123',
            role='SUPERADMIN',
            first_name='Super',
            last_name='Admin'
        )
        
        self.admin = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='ADMIN',
            first_name='Admin',
            last_name='User'
        )
        
        self.ceo = User.objects.create_user(
            username='ceo',
            email='ceo@example.com',
            password='testpass123',
            role='CEO',
            first_name='CEO',
            last_name='User'
        )
        
        self.professor = User.objects.create_user(
            username='professor',
            email='professor@example.com',
            password='testpass123',
            role='PROFESSOR',
            first_name='Professor',
            last_name='User'
        )
        
        self.student_member = User.objects.create_user(
            username='student_member',
            email='student_member@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Student',
            last_name='Member'
        )
        
        self.student_non_member = User.objects.create_user(
            username='student_non_member',
            email='student_non_member@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Student',
            last_name='NonMember'
        )
        
        # Create project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Project Description',
            status='IN_PROGRESS',
            created_by=self.admin
        )
        
        # Add members to project (not adding CEO or SUPERADMIN - they should have access anyway)
        ProjectMember.objects.create(
            project=self.project,
            user=self.professor,
            role=ProjectMember.ProjectRole.MEMBER
        )
        
        ProjectMember.objects.create(
            project=self.project,
            user=self.student_member,
            role=ProjectMember.ProjectRole.MEMBER
        )
        
        self.client = APIClient()
    
    @patch('apps.documents.api.views.GoogleDriveService')
    def test_superadmin_can_access_any_project_folders(self, mock_drive_service):
        """Test that SUPERADMIN can access folders for any project"""
        # Mock the Drive service to return some folders
        mock_instance = MagicMock()
        mock_instance.list_folders_for_project.return_value = [
            {'id': 'folder1', 'name': 'Folder 1', 'createdTime': None, 'modifiedTime': None}
        ]
        mock_drive_service.return_value = mock_instance
        
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should have called the Drive service
        mock_instance.list_folders_for_project.assert_called_once_with(str(self.project.id))
    
    @patch('apps.documents.api.views.GoogleDriveService')
    def test_admin_can_access_any_project_folders(self, mock_drive_service):
        """Test that ADMIN can access folders for any project"""
        mock_instance = MagicMock()
        mock_instance.list_folders_for_project.return_value = [
            {'id': 'folder1', 'name': 'Folder 1', 'createdTime': None, 'modifiedTime': None}
        ]
        mock_drive_service.return_value = mock_instance
        
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_instance.list_folders_for_project.assert_called_once_with(str(self.project.id))
    
    @patch('apps.documents.api.views.GoogleDriveService')
    def test_ceo_can_access_any_project_folders(self, mock_drive_service):
        """Test that CEO can access folders for any project"""
        mock_instance = MagicMock()
        mock_instance.list_folders_for_project.return_value = [
            {'id': 'folder1', 'name': 'Folder 1', 'createdTime': None, 'modifiedTime': None}
        ]
        mock_drive_service.return_value = mock_instance
        
        self.client.force_authenticate(user=self.ceo)
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_instance.list_folders_for_project.assert_called_once_with(str(self.project.id))
    
    @patch('apps.documents.api.views.GoogleDriveService')
    def test_project_member_can_access_project_folders(self, mock_drive_service):
        """Test that a project member (non-admin role) can access their project folders"""
        mock_instance = MagicMock()
        mock_instance.list_folders_for_project.return_value = [
            {'id': 'folder1', 'name': 'Folder 1', 'createdTime': None, 'modifiedTime': None}
        ]
        mock_drive_service.return_value = mock_instance
        
        self.client.force_authenticate(user=self.student_member)
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_instance.list_folders_for_project.assert_called_once_with(str(self.project.id))
    
    @patch('apps.documents.api.views.GoogleDriveService')
    def test_non_member_cannot_access_project_folders(self, mock_drive_service):
        """Test that a non-member cannot access project folders"""
        mock_instance = MagicMock()
        mock_drive_service.return_value = mock_instance
        
        self.client.force_authenticate(user=self.student_non_member)
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 403 Forbidden
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
        self.assertIn('No tiene permisos', response.data['error'])
        # Should NOT have called the Drive service
        mock_instance.list_folders_for_project.assert_not_called()
    
    def test_missing_project_param_returns_400(self):
        """Test that missing project parameter returns 400 Bad Request"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/documents/folders/')
        
        # Should return 400 Bad Request
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_invalid_project_id_returns_404(self):
        """Test that invalid project ID returns 404 Not Found"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/v1/documents/folders/?project=99999')
        
        # Should return 404 Not Found
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
    
    def test_unauthenticated_user_cannot_access_folders(self):
        """Test that unauthenticated users cannot access folders"""
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should return 401 Unauthorized or 403 Forbidden
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
