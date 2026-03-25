from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.conf import settings

User = get_user_model()

class CookieAuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='StrongP@ssw0rd123!',
            email='test@example.com'
        )
        self.login_url = reverse('auth_login')
        self.refresh_url = reverse('token_refresh')
        self.logout_url = reverse('auth_logout')

    def test_login_sets_cookies(self):
        """Test that login sets access and refresh cookies and does not return them in body"""
        response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'StrongP@ssw0rd123!'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify tokens are NOT in the response body
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        
        # Verify cookies are set
        self.assertIn(settings.SIMPLE_JWT['AUTH_COOKIE'], response.cookies)
        self.assertIn(settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'], response.cookies)
        
        # Verify HttpOnly flag
        self.assertTrue(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]['httponly'])
        self.assertTrue(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]['httponly'])

    def test_authenticated_request_with_cookie(self):
        """Test that a request with the access cookie is authenticated"""
        # First login to get the cookie
        login_response = self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'StrongP@ssw0rd123!'
        })
        
        # Access a protected endpoint (profile)
        # APIClient maintains cookies between requests by default if they are set in the response
        response = self.client.get(reverse('auth_profile'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'testuser')

    def test_token_refresh_with_cookie(self):
        """Test that token refresh works using the refresh cookie"""
        # Login
        self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'StrongP@ssw0rd123!'
        })
        
        # Clear access cookie to simulate expiration (manual clear in test client)
        self.client.cookies.pop(settings.SIMPLE_JWT['AUTH_COOKIE'])
        
        # Verify we are now unauthenticated
        unauth_response = self.client.get(reverse('auth_profile'))
        self.assertEqual(unauth_response.status_code, status.HTTP_401_UNAUTHORIZED)
        
        # Perform refresh
        refresh_response = self.client.post(self.refresh_url)
        
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn(settings.SIMPLE_JWT['AUTH_COOKIE'], refresh_response.cookies)
        
        # Verify we are authenticated again
        auth_response = self.client.get(reverse('auth_profile'))
        self.assertEqual(auth_response.status_code, status.HTTP_200_OK)

    def test_logout_clears_cookies(self):
        """Test that logout deletes the cookies"""
        # Login
        self.client.post(self.login_url, {
            'username': 'testuser',
            'password': 'StrongP@ssw0rd123!'
        })
        
        # Logout
        response = self.client.post(self.logout_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify cookies are cleared (deleted cookies have an empty value and expired date in Django tests)
        # Actually in test client, delete_cookie sets value to ''
        self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE']]['value'], '')
        self.assertEqual(response.cookies[settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']]['value'], '')
        
        # Verify we can no longer access protected endpoint
        protected_response = self.client.get(reverse('auth_profile'))
        self.assertEqual(protected_response.status_code, status.HTTP_401_UNAUTHORIZED)
