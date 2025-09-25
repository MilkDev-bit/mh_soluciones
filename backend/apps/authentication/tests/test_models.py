from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

class CustomUserModelTest(TestCase):
    def setUp(self):
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'role': 'ADMIN',
            'first_name': 'Test',
            'last_name': 'User'
        }

    def test_create_user(self):
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(user.username, self.user_data['username'])
        self.assertEqual(user.email, self.user_data['email'])
        self.assertEqual(user.role, self.user_data['role'])
        self.assertTrue(user.check_password(self.user_data['password']))
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_superuser(self):
        admin_user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.assertEqual(admin_user.username, 'admin')
        self.assertEqual(admin_user.email, 'admin@example.com')
        self.assertEqual(admin_user.role, 'SUPERADMIN')
        self.assertTrue(admin_user.is_active)
        self.assertTrue(admin_user.is_staff)
        self.assertTrue(admin_user.is_superuser)

    def test_user_str_representation(self):
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(str(user), "Test User (testuser)")

    def test_user_has_2fa_property(self):
        user = User.objects.create_user(**self.user_data)
        self.assertFalse(user.has_2fa_configured)

    def test_user_time_tracking(self):
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(user.total_time_spent, timedelta(0))
        
        user.total_time_spent = timedelta(hours=5, minutes=30)
        user.last_activity = timezone.now()
        user.save()
        
        updated_user = User.objects.get(pk=user.pk)
        self.assertEqual(updated_user.total_time_spent, timedelta(hours=5, minutes=30))
        self.assertIsNotNone(updated_user.last_activity)

    def test_ip_restriction(self):
        user = User.objects.create_user(**self.user_data)
        user.allowed_ips = "192.168.1.1, 10.0.0.1"
        user.save()
        
        self.assertEqual(user.allowed_ips, "192.168.1.1, 10.0.0.1")