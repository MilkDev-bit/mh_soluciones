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


class ApiRootTestCase(TestCase):
    """Test cases for the API root endpoint."""
    
    def setUp(self):
        self.client = Client()
    
    def test_api_root_returns_200(self):
        """Test that API root endpoint returns 200 OK."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
    
    def test_api_root_returns_json(self):
        """Test that API root returns valid JSON with expected fields."""
        response = self.client.get('/')
        data = response.json()
        
        # Check required fields
        self.assertIn('message', data)
        self.assertIn('status', data)
        self.assertIn('version', data)
        self.assertIn('endpoints', data)
        
        # Check specific values
        self.assertEqual(data['message'], 'MH Soluciones Empresariales API')
        self.assertEqual(data['status'], 'running')
        self.assertEqual(data['version'], '1.0.0')
        
        # Check endpoints structure
        endpoints = data['endpoints']
        self.assertIn('health', endpoints)
        self.assertIn('admin', endpoints)
        self.assertIn('api', endpoints)
        self.assertIn('docs', endpoints)
    
    def test_api_root_named_url(self):
        """Test that API root works via named URL."""
        url = reverse('root')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
    
    def test_api_root_only_get_allowed(self):
        """Test that only GET method is allowed on API root."""
        # POST should not be allowed
        response = self.client.post('/')
        self.assertEqual(response.status_code, 405)  # Method Not Allowed


class FaviconTestCase(TestCase):
    """Test cases for the favicon endpoint."""
    
    def setUp(self):
        self.client = Client()
    
    def test_favicon_returns_204(self):
        """Test that favicon endpoint returns 204 No Content."""
        response = self.client.get('/favicon.ico')
        self.assertEqual(response.status_code, 204)
    
    def test_favicon_named_url(self):
        """Test that favicon works via named URL."""
        url = reverse('favicon')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 204)
    
    def test_favicon_only_get_allowed(self):
        """Test that only GET method is allowed on favicon."""
        # POST should not be allowed
        response = self.client.post('/favicon.ico')
        self.assertEqual(response.status_code, 405)  # Method Not Allowed

