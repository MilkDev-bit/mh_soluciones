"""Búsqueda de Equipos sin importar acentos, mayúsculas, signos ni orden."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.core.search import search_tokens, token_regex
from apps.projects.models import Project

User = get_user_model()


class ProjectSearchTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username='adm', email='a@x.com', password='x', role='SUPERADMIN')
        mk = lambda name, desc: Project.objects.create(name=name, description=desc, status='IN_PROGRESS',
                                                       created_by=self.admin)
        mk('CEDIS BAJÍO', 'DET REGIÓN 2 NORTE')
        mk('BAE Peñasco', 'Obra nueva región 3 centro-sur')
        mk('SC JULIAN TREVIÑO', 'DET 6454 OBRA NUEVA REGIÓN 2 NORTE')
        mk('Axioma', 'Supervisión de seguridad industrial')
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def names(self, q):
        res = self.client.get('/api/v1/projects/', {'search': q, 'all': 'true'})
        self.assertEqual(res.status_code, 200)
        data = res.data if isinstance(res.data, list) else res.data['results']
        return sorted(p['name'] for p in data)

    def test_without_accents_finds_accented(self):
        self.assertEqual(self.names('bajio'), ['CEDIS BAJÍO'])
        self.assertEqual(self.names('supervision'), ['Axioma'])

    def test_with_accents_finds_unaccented_and_case(self):
        self.assertEqual(self.names('AXIÓMA'), ['Axioma'])

    def test_n_and_enie(self):
        self.assertEqual(self.names('penasco'), ['BAE Peñasco'])
        self.assertEqual(self.names('treviño'), ['SC JULIAN TREVIÑO'])
        self.assertEqual(self.names('trevino'), ['SC JULIAN TREVIÑO'])

    def test_word_order_punctuation_and_fields(self):
        self.assertEqual(self.names('norte region-2'), ['CEDIS BAJÍO', 'SC JULIAN TREVIÑO'])
        self.assertEqual(self.names('centro sur'), ['BAE Peñasco'])
        self.assertEqual(self.names('cedis  norte'), ['CEDIS BAJÍO'])

    def test_no_match(self):
        self.assertEqual(self.names('monterrey'), [])

    def test_helpers(self):
        self.assertEqual(search_tokens(' Región-2, NORTE '), ['region', '2', 'norte'])
        self.assertIn('[', token_regex('a.b'))
        self.assertIn(r'\.', token_regex('a.b'))
