from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.projects.models import Project
from apps.tasks.models import Task
from apps.tasks.api.serializers import TaskSerializer

User = get_user_model()


class TaskSerializerTest(TestCase):
    """Test that TaskSerializer includes created_at and updated_at fields"""
    
    def setUp(self):
        # Create a teacher user
        self.teacher = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='testpass123',
            role='PROFESSOR',
            first_name='Teacher',
            last_name='User'
        )
        
        # Create a project
        self.project = Project.objects.create(
            name='Test Project',
            description='Test Description',
            status='IN_PROGRESS',
            created_by=self.teacher
        )
        
        # Create a task
        self.task = Task.objects.create(
            title='Test Task',
            description='Test task description',
            project=self.project,
            created_by=self.teacher,
            status='OPEN',
            priority='MEDIUM',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=7),
            max_score=100
        )
    
    def test_task_serializer_includes_created_at(self):
        """Test that TaskSerializer includes created_at field"""
        serializer = TaskSerializer(instance=self.task)
        data = serializer.data
        
        self.assertIn('created_at', data)
        self.assertIsNotNone(data['created_at'])
    
    def test_task_serializer_includes_updated_at(self):
        """Test that TaskSerializer includes updated_at field"""
        serializer = TaskSerializer(instance=self.task)
        data = serializer.data
        
        self.assertIn('updated_at', data)
        self.assertIsNotNone(data['updated_at'])
    
    def test_task_list_serializer_has_timestamp_fields(self):
        """Test that serializing a list of tasks includes timestamp fields"""
        # Create another task
        task2 = Task.objects.create(
            title='Test Task 2',
            description='Another test task',
            project=self.project,
            created_by=self.teacher,
            status='OPEN',
            priority='HIGH',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=5),
            max_score=100
        )
        
        tasks = [self.task, task2]
        serializer = TaskSerializer(tasks, many=True)
        data = serializer.data
        
        # Check both tasks have the fields
        for task_data in data:
            self.assertIn('created_at', task_data)
            self.assertIn('updated_at', task_data)
            self.assertIsNotNone(task_data['created_at'])
            self.assertIsNotNone(task_data['updated_at'])
