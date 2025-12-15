from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.projects.models import Project, ProjectMember

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
        self.assertIn('task_stats', response.data)
        self.assertIn('priority_stats', response.data)
        self.assertIn('total_tasks', response.data)
        self.assertIn('progress_percentage', response.data)
    
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
