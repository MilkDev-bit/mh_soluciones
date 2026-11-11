from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.projects.models import Project, ProjectMember, ProjectSubmission

User = get_user_model()


class ProgressStatsPermissionTest(TestCase):
    """Test that project members can access progress-stats endpoint"""
    
    def setUp(self):
        # Create users
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
            last_name='User'
        )
        
        self.non_member = User.objects.create_user(
            username='nonmember',
            email='nonmember@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Non',
            last_name='Member'
        )
        
        # Create project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Project Description',
            status='IN_PROGRESS',
            created_by=self.admin
        )
        
        # Add admin as member
        ProjectMember.objects.create(
            project=self.project,
            user=self.admin,
            role=ProjectMember.ProjectRole.LEAD
        )
        
        # Add student as member
        ProjectMember.objects.create(
            project=self.project,
            user=self.student,
            role=ProjectMember.ProjectRole.MEMBER
        )
        
        self.client = APIClient()
    
    def test_student_member_can_access_progress_stats(self):
        """Test that a student who is a project member can access progress-stats"""
        self.client.force_authenticate(user=self.student)
        response = self.client.get(f'/api/v1/projects/{self.project.id}/progress-stats/')
        
        # Should return 200 OK, not 403 Forbidden
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify response has expected structure
        for key in ('current', 'previous', 'trend', 'punctuality', 'safety', 'review', 'timeline', 'total_tasks'):
            self.assertIn(key, response.data)
    
    def test_non_member_cannot_access_progress_stats(self):
        """Test that a student who is not a project member cannot access progress-stats"""
        self.client.force_authenticate(user=self.non_member)
        response = self.client.get(f'/api/v1/projects/{self.project.id}/progress-stats/')
        
        # Should return 404 Not Found (project not in user's queryset) or 403 Forbidden
        self.assertIn(response.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
    
    def test_admin_can_access_progress_stats(self):
        """Test that an admin can access progress-stats"""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/projects/{self.project.id}/progress-stats/')
        
        # Should return 200 OK
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_unauthenticated_cannot_access_progress_stats(self):
        """Test that unauthenticated users cannot access progress-stats"""
        response = self.client.get(f'/api/v1/projects/{self.project.id}/progress-stats/')
        
        # Should return 401 Unauthorized or 403 Forbidden
        self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])


class ProjectSubmissionFileUrlTest(TestCase):
    """Test that ProjectSubmission serializer returns absolute file URLs"""
    
    def setUp(self):
        # Create user
        self.admin = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass123',
            role='ADMIN',
            first_name='Admin',
            last_name='User'
        )
        
        # Create project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Project Description',
            status='IN_PROGRESS',
            created_by=self.admin
        )
        
        # Add admin as member
        ProjectMember.objects.create(
            project=self.project,
            user=self.admin,
            role=ProjectMember.ProjectRole.LEAD
        )
        
        self.client = APIClient()
    
    def test_project_submission_returns_absolute_file_url(self):
        """Test that file_url field contains absolute URL when file is present"""
        # Create a test file
        test_file = SimpleUploadedFile(
            "test_document.txt",
            b"Test file content",
            content_type="text/plain"
        )
        
        # Create submission with file
        submission = ProjectSubmission.objects.create(
            project=self.project,
            submitted_by=self.admin,
            notes="Test submission",
            file=test_file
        )
        
        # Get project detail which includes submissions
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/projects/{self.project.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('submissions', response.data)
        self.assertEqual(len(response.data['submissions']), 1)
        
        submission_data = response.data['submissions'][0]
        
        # Verify file_url field exists
        self.assertIn('file_url', submission_data)
        
        # Verify file_url is an absolute URL (starts with http:// or https://)
        if submission_data['file_url']:
            self.assertTrue(
                submission_data['file_url'].startswith('http://') or 
                submission_data['file_url'].startswith('https://'),
                f"file_url should be absolute but got: {submission_data['file_url']}"
            )
            
            # Verify it contains the file path
            self.assertIn('project_submissions', submission_data['file_url'])
            self.assertIn('test_document', submission_data['file_url'])
    
    def test_project_submission_file_url_null_when_no_file(self):
        """Test that file_url is null when no file is uploaded"""
        # Create submission without file
        submission = ProjectSubmission.objects.create(
            project=self.project,
            submitted_by=self.admin,
            notes="Test submission without file",
            link="https://example.com/document"
        )
        
        # Get project detail
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(f'/api/v1/projects/{self.project.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        submission_data = response.data['submissions'][0]
        
        # Verify file_url is None when no file
        self.assertIsNone(submission_data['file_url'])
