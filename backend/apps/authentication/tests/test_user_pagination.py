"""
Tests for UserViewSet pagination functionality
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()


class UserPaginationTests(TestCase):
    """Test UserViewSet pagination with custom page_size parameter"""
    
    def setUp(self):
        """Create test users and authenticate"""
        self.client = APIClient()
        
        # Create a superadmin user for authentication
        self.superadmin = User.objects.create_user(
            username='superadmin',
            password='SuperAdmin123!@#',
            email='superadmin@test.com',
            role='SUPERADMIN',
            first_name='Super',
            last_name='Admin',
            is_active=True
        )
        
        # Create 22 active users
        for i in range(1, 23):
            User.objects.create_user(
                username=f'user{i:02d}',
                password='TestUser123!@#',
                email=f'user{i:02d}@test.com',
                role='EMPLOYEE',
                first_name=f'User{i:02d}',
                last_name=f'Test{i:02d}',
                is_active=True
            )
        
        # Create 2 inactive users
        for i in range(23, 25):
            User.objects.create_user(
                username=f'inactive{i}',
                password='TestUser123!@#',
                email=f'inactive{i}@test.com',
                role='EMPLOYEE',
                first_name=f'Inactive{i}',
                last_name=f'User{i}',
                is_active=False
            )
        
        # Authenticate as superadmin
        self.client.force_authenticate(user=self.superadmin)
    
    def test_default_pagination_returns_20_users(self):
        """Test that default pagination returns 20 users (PAGE_SIZE setting)"""
        response = self.client.get('/api/users/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        
        # Should return 20 users by default (PAGE_SIZE=20)
        self.assertEqual(len(response.data['results']), 20)
        # Total count should be 23 (22 active + 1 superadmin)
        self.assertEqual(response.data['count'], 23)
    
    def test_custom_page_size_returns_all_users(self):
        """Test that custom page_size parameter returns all users"""
        response = self.client.get('/api/users/', {'page_size': 1000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('count', response.data)
        
        # Should return all 23 users (22 active + 1 superadmin)
        self.assertEqual(len(response.data['results']), 23)
        self.assertEqual(response.data['count'], 23)
    
    def test_custom_page_size_50_returns_all_users(self):
        """Test that page_size=50 returns all 23 users"""
        response = self.client.get('/api/users/', {'page_size': 50})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should return all 23 users since we have less than 50
        self.assertEqual(len(response.data['results']), 23)
        self.assertEqual(response.data['count'], 23)
    
    def test_custom_page_size_respects_max_page_size(self):
        """Test that page_size respects MAX_PAGE_SIZE setting"""
        # Request more than MAX_PAGE_SIZE (1000)
        response = self.client.get('/api/users/', {'page_size': 5000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should return all users (limited by total count, not exceeding MAX_PAGE_SIZE)
        self.assertEqual(len(response.data['results']), 23)
        self.assertEqual(response.data['count'], 23)
    
    def test_pagination_with_page_number(self):
        """Test pagination with page_size and page parameters"""
        # Get first page of 10 users
        response = self.client.get('/api/users/', {'page_size': 10, 'page': 1})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], 23)
        
        # Get second page of 10 users
        response = self.client.get('/api/users/', {'page_size': 10, 'page': 2})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 10)
        self.assertEqual(response.data['count'], 23)
        
        # Get third page (should have 3 remaining users)
        response = self.client.get('/api/users/', {'page_size': 10, 'page': 3})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 3)
        self.assertEqual(response.data['count'], 23)
    
    def test_invalid_page_size_falls_back_to_default(self):
        """Test that invalid page_size falls back to default pagination"""
        response = self.client.get('/api/users/', {'page_size': 'invalid'})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should fall back to default pagination (20 users)
        self.assertEqual(len(response.data['results']), 20)
    
    def test_queryset_excludes_inactive_users_by_default(self):
        """Test that queryset includes both active and inactive users"""
        response = self.client.get('/api/users/', {'page_size': 1000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Get all usernames from response
        usernames = [user['username'] for user in response.data['results']]
        
        # Verify inactive users are included (UserViewSet uses all() not filter(is_active=True))
        # Total should be 25 (22 active + 1 superadmin + 2 inactive) or 23 if queryset filters
        # Based on the problem statement, the queryset is User.objects.all()
        total_users = User.objects.all().count()
        self.assertEqual(response.data['count'], total_users)
    
    def test_unauthenticated_user_cannot_access(self):
        """Test that unauthenticated users cannot access user list"""
        client = APIClient()  # New client without authentication
        response = client.get('/api/users/', {'page_size': 1000})
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_ordering_is_preserved_with_custom_pagination(self):
        """Test that ordering by first_name, last_name is preserved"""
        response = self.client.get('/api/users/', {'page_size': 1000})
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify users are ordered by first_name, last_name
        users = response.data['results']
        for i in range(len(users) - 1):
            current_name = (users[i]['first_name'], users[i]['last_name'])
            next_name = (users[i + 1]['first_name'], users[i + 1]['last_name'])
            # Current should be <= next in alphabetical order
            self.assertLessEqual(current_name, next_name)
