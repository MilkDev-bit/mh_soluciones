"""
Tests for Google OAuth SUPERADMIN role restrictions
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock

User = get_user_model()


class GoogleOAuthPermissionsTests(TestCase):
    """Test that Google OAuth is restricted to SUPERADMIN only"""
    
    def setUp(self):
        self.client = APIClient()
        
        # Create users with different roles
        self.superadmin = User.objects.create_user(
            username='superadmin',
            password='StrongP@ssw0rd123',
            email='superadmin@example.com',
            role='SUPERADMIN'
        )
        
        self.admin = User.objects.create_user(
            username='admin',
            password='StrongP@ssw0rd123',
            email='admin@example.com',
            role='ADMIN'
        )
        
        self.professor = User.objects.create_user(
            username='professor',
            password='StrongP@ssw0rd123',
            email='professor@example.com',
            role='PROFESSOR'
        )
        
        self.student = User.objects.create_user(
            username='student',
            password='StrongP@ssw0rd123',
            email='student@example.com',
            role='STUDENT'
        )
        
        self.client_user = User.objects.create_user(
            username='client',
            password='StrongP@ssw0rd123',
            email='client@example.com',
            role='CLIENT'
        )
        
        self.auth_url = '/api/v1/auth/google/auth/'
        self.callback_url = '/api/v1/auth/google/callback/'
    
    def test_superadmin_can_access_google_auth(self):
        """Test that SUPERADMIN can access Google OAuth redirect endpoint"""
        self.client.force_authenticate(user=self.superadmin)
        
        with patch('apps.authentication.api.views.Flow') as mock_flow:
            # Mock the Flow to avoid actual Google API calls
            mock_flow_instance = MagicMock()
            mock_flow_instance.authorization_url.return_value = ('http://google.com/auth', 'state123')
            mock_flow.from_client_config.return_value = mock_flow_instance
            
            response = self.client.get(self.auth_url)
            
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertIn('authorization_url', response.data)
    
    def test_admin_cannot_access_google_auth(self):
        """Test that ADMIN cannot access Google OAuth redirect endpoint"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.auth_url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
        self.assertIn('SUPERADMIN', response.data['error'])
    
    def test_professor_cannot_access_google_auth(self):
        """Test that PROFESSOR cannot access Google OAuth redirect endpoint"""
        self.client.force_authenticate(user=self.professor)
        response = self.client.get(self.auth_url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
    
    def test_student_cannot_access_google_auth(self):
        """Test that STUDENT cannot access Google OAuth redirect endpoint"""
        self.client.force_authenticate(user=self.student)
        response = self.client.get(self.auth_url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
    
    def test_client_cannot_access_google_auth(self):
        """Test that CLIENT cannot access Google OAuth redirect endpoint"""
        self.client.force_authenticate(user=self.client_user)
        response = self.client.get(self.auth_url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
    
    def test_unauthenticated_cannot_access_google_auth(self):
        """Test that unauthenticated users cannot access Google OAuth"""
        response = self.client.get(self.auth_url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    @patch('apps.authentication.api.views.cache')
    @patch('apps.authentication.api.views.Flow')
    def test_callback_rejects_non_superadmin(self, mock_flow, mock_cache):
        """Test that OAuth callback rejects non-SUPERADMIN users"""
        # Setup mock cache to return admin user ID
        mock_cache.get.return_value = self.admin.id
        
        response = self.client.post(self.callback_url, {
            'code': '4/0test-authorization-code',
            'state': 'test-state-123'
        })
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error', response.data)
        self.assertEqual(response.data['error_type'], 'error_permissions')
    
    @patch('apps.authentication.api.views.cache')
    @patch('apps.authentication.api.views.Flow')
    @patch('apps.authentication.api.views.GoogleApiCredentials')
    def test_callback_accepts_superadmin(self, mock_credentials, mock_flow, mock_cache):
        """Test that OAuth callback accepts SUPERADMIN users"""
        # Setup mock cache to return superadmin user ID
        mock_cache.get.return_value = self.superadmin.id
        
        # Mock the Flow
        mock_flow_instance = MagicMock()
        mock_credentials_obj = MagicMock()
        mock_credentials_obj.token = 'test-token'
        mock_credentials_obj.refresh_token = 'test-refresh-token'
        mock_credentials_obj.token_uri = 'https://oauth2.googleapis.com/token'
        mock_credentials_obj.client_id = 'test-client-id'
        mock_credentials_obj.client_secret = 'test-client-secret'
        mock_credentials_obj.scopes = ['https://www.googleapis.com/auth/drive']
        mock_flow_instance.credentials = mock_credentials_obj
        mock_flow.from_client_config.return_value = mock_flow_instance
        
        # Mock credentials update_or_create
        mock_credentials.objects.update_or_create.return_value = (MagicMock(), True)
        
        response = self.client.post(self.callback_url, {
            'code': '4/0test-authorization-code',
            'state': 'test-state-123'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
    
    def test_error_message_mentions_institutional_drive(self):
        """Test that error messages reference 'institutional' Google Drive"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.auth_url)
        
        error_message = response.data['error'].lower()
        self.assertIn('institucional', error_message)
