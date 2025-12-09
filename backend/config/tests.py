from django.test import TestCase, Client, override_settings
from django.urls import reverse


class HealthCheckTestCase(TestCase):
    """Test cases for the health check endpoint."""
    
    def setUp(self):
        self.client = Client()
        
    def test_health_check_returns_200(self):
        """Test that health check endpoint returns 200 OK."""
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'healthy'})
        
    def test_health_check_named_url(self):
        """Test that health check works via named URL."""
        url = reverse('health_check')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'healthy'})


@override_settings(
    SECURE_SSL_REDIRECT=True,
    SECURE_REDIRECT_EXEMPT=[r'^health/$']
)
class HealthCheckSSLExemptionTestCase(TestCase):
    """Test that health check is exempt from SSL redirect."""
    
    def setUp(self):
        self.client = Client()
    
    def test_health_check_not_redirected(self):
        """Test that /health/ endpoint is not redirected to HTTPS."""
        # When SECURE_SSL_REDIRECT is True and health is exempt,
        # the endpoint should return 200, not 301
        response = self.client.get('/health/', secure=False)
        # Should NOT be a redirect
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'healthy'})
