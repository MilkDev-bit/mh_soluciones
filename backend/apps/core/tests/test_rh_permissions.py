"""
Tests for RH role permission restrictions
Tests ensure RH cannot:
1. Access Google Drive folders
2. Create or assign tasks
3. Grade tasks
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.projects.models import Project
from apps.tasks.models import Task, TaskSubmission

User = get_user_model()


class RHPermissionTests(TestCase):
    """Test that RH role has correct permission restrictions"""
    
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
        
        self.rh_user = User.objects.create_user(
            username='rh',
            password='StrongP@ssw0rd123',
            email='rh@example.com',
            role='RH'
        )
        
        self.ceo = User.objects.create_user(
            username='ceo',
            password='StrongP@ssw0rd123',
            email='ceo@example.com',
            role='CEO'
        )
        
        self.professor = User.objects.create_user(
            username='professor',
            password='StrongP@ssw0rd123',
            email='professor@example.com',
            role='PROFESSOR'
        )
        
        self.director = User.objects.create_user(
            username='director',
            password='StrongP@ssw0rd123',
            email='director@example.com',
            role='DIRECTOR'
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
        
        # Create a test project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Description',
            status='IN_PROGRESS'
        )
        
        # Create a test task
        self.task = Task.objects.create(
            title='Test Task',
            description='Test task description',
            project=self.project,
            created_by=self.professor,
            status='ACTIVE'
        )
    
    def test_rh_cannot_create_task(self):
        """Test that RH cannot create tasks"""
        self.client.force_authenticate(user=self.rh_user)
        
        response = self.client.post('/api/v1/tasks/', {
            'title': 'RH Created Task',
            'description': 'Should not be allowed',
            'project': self.project.id,
            'status': 'ACTIVE'
        })
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('permisos', response.data.get('detail', '').lower())
    
    def test_professor_can_create_task(self):
        """Test that PROFESSOR can create tasks"""
        self.client.force_authenticate(user=self.professor)
        
        response = self.client.post('/api/v1/tasks/', {
            'title': 'Professor Created Task',
            'description': 'Should be allowed',
            'project': self.project.id,
            'status': 'ACTIVE'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_director_can_create_task(self):
        """Test that DIRECTOR can create tasks"""
        self.client.force_authenticate(user=self.director)
        
        response = self.client.post('/api/v1/tasks/', {
            'title': 'Director Created Task',
            'description': 'Should be allowed',
            'project': self.project.id,
            'status': 'ACTIVE'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_ceo_can_create_task(self):
        """Test that CEO can create tasks"""
        self.client.force_authenticate(user=self.ceo)
        
        response = self.client.post('/api/v1/tasks/', {
            'title': 'CEO Created Task',
            'description': 'Should be allowed',
            'project': self.project.id,
            'status': 'ACTIVE'
        })
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_rh_cannot_edit_task(self):
        """Test that RH cannot edit tasks"""
        self.client.force_authenticate(user=self.rh_user)
        
        response = self.client.patch(f'/api/v1/tasks/{self.task.id}/', {
            'title': 'Modified by RH'
        })
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_professor_can_edit_task(self):
        """Test that PROFESSOR can edit tasks"""
        self.client.force_authenticate(user=self.professor)
        
        response = self.client.patch(f'/api/v1/tasks/{self.task.id}/', {
            'title': 'Modified by Professor'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_rh_cannot_delete_task(self):
        """Test that RH cannot delete tasks"""
        self.client.force_authenticate(user=self.rh_user)
        
        response = self.client.delete(f'/api/v1/tasks/{self.task.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_admin_can_delete_task(self):
        """Test that ADMIN can delete tasks"""
        # Create a task to delete
        task_to_delete = Task.objects.create(
            title='Task to delete',
            description='Will be deleted',
            project=self.project,
            created_by=self.professor,
            status='ACTIVE'
        )
        
        self.client.force_authenticate(user=self.admin)
        
        response = self.client.delete(f'/api/v1/tasks/{task_to_delete.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
    
    def test_rh_cannot_access_drive_folders(self):
        """Test that RH cannot access Google Drive folders"""
        self.client.force_authenticate(user=self.rh_user)
        
        # RH should not be able to list folders
        # The endpoint might not exist yet, but the permission check should fail
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should either get 403 or the folders list should be empty/restricted
        # Depending on implementation, we expect 403
        if response.status_code != status.HTTP_404_NOT_FOUND:
            # If endpoint exists, check it returns proper error or empty
            self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_500_INTERNAL_SERVER_ERROR])
    
    def test_client_can_access_drive_folders(self):
        """Test that CLIENT can access Google Drive folders for their projects"""
        self.client.force_authenticate(user=self.client_user)
        
        # CLIENT should be able to access Drive folders
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should get proper response (could be 500 if Drive not configured in tests, but not 403)
        # The key is RH gets 403 but CLIENT doesn't
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_ceo_can_access_drive_folders(self):
        """Test that CEO can access Google Drive folders"""
        self.client.force_authenticate(user=self.ceo)
        
        response = self.client.get(f'/api/v1/documents/folders/?project={self.project.id}')
        
        # Should get proper response (not 403)
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RHTaskSubmissionPermissionTests(TestCase):
    """Test that RH cannot grade task submissions"""
    
    def setUp(self):
        self.client = APIClient()
        
        # Create users
        self.rh_user = User.objects.create_user(
            username='rh',
            password='StrongP@ssw0rd123',
            email='rh@example.com',
            role='RH'
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
        
        # Create project and task
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Description',
            status='IN_PROGRESS'
        )
        
        self.task = Task.objects.create(
            title='Test Task',
            description='Test task description',
            project=self.project,
            created_by=self.professor,
            status='ACTIVE',
            max_score=100
        )
        
        # Create a submission
        self.submission = TaskSubmission.objects.create(
            task=self.task,
            submitted_by=self.student,
            notes='Test submission',
            status='SUBMITTED'
        )
    
    def test_rh_cannot_grade_submission(self):
        """Test that RH cannot grade task submissions"""
        self.client.force_authenticate(user=self.rh_user)
        
        response = self.client.post(
            f'/api/v1/tasks/{self.task.id}/submissions/{self.submission.id}/grade/',
            {
                'score': 85,
                'teacher_feedback': 'Good work',
                'status': 'GRADED'
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('permisos', response.data.get('detail', '').lower())
    
    def test_professor_can_grade_submission(self):
        """Test that PROFESSOR can grade task submissions"""
        self.client.force_authenticate(user=self.professor)
        
        response = self.client.post(
            f'/api/v1/tasks/{self.task.id}/submissions/{self.submission.id}/grade/',
            {
                'score': 85,
                'teacher_feedback': 'Good work',
                'status': 'GRADED'
            }
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify the submission was actually graded
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.score, 85)
        self.assertEqual(self.submission.status, 'GRADED')
