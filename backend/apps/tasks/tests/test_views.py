from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task
from apps.tasks.api.views import TaskViewSet

User = get_user_model()


class StudentTaskVisibilityTest(TestCase):
    """Test that students can see tasks assigned to them and from their projects"""
    
    def setUp(self):
        # Create users
        self.teacher = User.objects.create_user(
            username='teacher',
            email='teacher@example.com',
            password='testpass123',
            role='PROFESSOR',
            first_name='Teacher',
            last_name='User'
        )
        
        self.student1 = User.objects.create_user(
            username='student1',
            email='student1@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Student',
            last_name='One'
        )
        
        self.student2 = User.objects.create_user(
            username='student2',
            email='student2@example.com',
            password='testpass123',
            role='STUDENT',
            first_name='Student',
            last_name='Two'
        )
        
        # Create projects
        self.project1 = Project.objects.create(
            name='Project 1',
            description='Test Project 1',
            status='IN_PROGRESS',
            created_by=self.teacher
        )
        
        self.project2 = Project.objects.create(
            name='Project 2',
            description='Test Project 2',
            status='IN_PROGRESS',
            created_by=self.teacher
        )
        
        # Add student1 as member of project1
        ProjectMember.objects.create(
            project=self.project1,
            user=self.student1,
            role='MEMBER'
        )
        
        # Add student2 as member of project2
        ProjectMember.objects.create(
            project=self.project2,
            user=self.student2,
            role='MEMBER'
        )
        
        # Create tasks
        # Task 1: In project1, no specific assignment
        self.task1 = Task.objects.create(
            title='Task 1 - Project 1 General',
            description='Task for project 1',
            project=self.project1,
            created_by=self.teacher,
            status='OPEN',
            priority='MEDIUM',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=7),
            max_score=100
        )
        
        # Task 2: In project1, assigned to student1
        self.task2 = Task.objects.create(
            title='Task 2 - Assigned to Student1',
            description='Task assigned to student1',
            project=self.project1,
            created_by=self.teacher,
            assigned_to=self.student1,
            status='OPEN',
            priority='HIGH',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=5),
            max_score=100
        )
        
        # Task 3: In project2, assigned to student2
        self.task3 = Task.objects.create(
            title='Task 3 - Assigned to Student2',
            description='Task assigned to student2',
            project=self.project2,
            created_by=self.teacher,
            assigned_to=self.student2,
            status='OPEN',
            priority='MEDIUM',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=7),
            max_score=100
        )
        
        # Task 4: In project1, with student1 in assigned_students
        self.task4 = Task.objects.create(
            title='Task 4 - Student1 in assigned_students',
            description='Task with student1 in assigned_students list',
            project=self.project1,
            created_by=self.teacher,
            status='OPEN',
            priority='LOW',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=10),
            max_score=100
        )
        self.task4.assigned_students.add(self.student1)
        
        # Task 5: Draft task (should be hidden from students)
        self.task5 = Task.objects.create(
            title='Task 5 - Draft',
            description='Draft task',
            project=self.project1,
            created_by=self.teacher,
            assigned_to=self.student1,
            status='DRAFT',
            priority='MEDIUM',
            open_date=timezone.now(),
            close_date=timezone.now() + timezone.timedelta(days=7),
            max_score=100
        )
        
        # Set up the API request factory
        self.factory = APIRequestFactory()
    
    def test_student_sees_tasks_from_their_project(self):
        """Test that student1 sees task1 from project1 where they are a member"""
        # Create a mock request with student1
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        # Get the viewset and queryset
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        # Student1 should see tasks from project1
        self.assertIn(self.task1, queryset, "Student should see general tasks from their project")
    
    def test_student_sees_directly_assigned_tasks(self):
        """Test that student1 sees task2 which is directly assigned to them"""
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        self.assertIn(self.task2, queryset, "Student should see tasks directly assigned to them")
    
    def test_student_sees_assigned_students_tasks(self):
        """Test that student1 sees task4 where they are in assigned_students"""
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        self.assertIn(self.task4, queryset, "Student should see tasks where they are in assigned_students")
    
    def test_student_does_not_see_other_students_tasks(self):
        """Test that student1 does not see task3 which is for student2"""
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        self.assertNotIn(self.task3, queryset, "Student should not see tasks assigned to other students")
    
    def test_student_does_not_see_draft_tasks(self):
        """Test that student1 does not see draft tasks even if assigned to them"""
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        self.assertNotIn(self.task5, queryset, "Student should not see draft tasks")
    
    def test_student_task_count(self):
        """Test that student1 sees exactly the correct number of tasks"""
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        # Student1 should see: task1, task2, task4 (3 tasks total)
        # They should NOT see: task3 (different student), task5 (draft)
        self.assertEqual(queryset.count(), 3, "Student1 should see exactly 3 tasks")
    
    def test_student_project_filter(self):
        """Test that filtering by project works correctly for students"""
        request = self.factory.get('/api/tasks/', {'project': self.project1.id})
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        # All tasks in queryset should be from project1
        for task in queryset:
            self.assertEqual(task.project.id, self.project1.id)
    
    def test_teacher_sees_all_tasks(self):
        """Test that teachers see all tasks including drafts"""
        request = self.factory.get('/api/tasks/')
        request.user = self.teacher
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        # Teacher should see all tasks (including draft)
        self.assertEqual(queryset.count(), 5, "Teacher should see all 5 tasks")
    
    def test_queryset_is_distinct(self):
        """Test that queryset doesn't return duplicate tasks"""
        # Add student1 to task2's assigned_students as well (they're already assigned_to)
        self.task2.assigned_students.add(self.student1)
        
        request = self.factory.get('/api/tasks/')
        request.user = self.student1
        
        viewset = TaskViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        queryset = viewset.get_queryset()
        
        # Count how many times task2 appears
        task2_count = sum(1 for task in queryset if task.id == self.task2.id)
        self.assertEqual(task2_count, 1, "Task should appear only once even if matched by multiple conditions")
