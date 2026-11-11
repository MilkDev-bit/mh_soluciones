"""Drive usa el client_secret actual del servidor (permite rotarlo sin reconectar)."""
from types import SimpleNamespace

from django.test import SimpleTestCase, override_settings

from apps.documents.services import oauth_client_for


@override_settings(GOOGLE_CLIENT_ID='cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET='GOCSPX-nuevo')
class OAuthClientForTests(SimpleTestCase):
    def test_same_client_uses_current_secret(self):
        stored = SimpleNamespace(client_id='cid.apps.googleusercontent.com', client_secret='GOCSPX-filtrado')
        self.assertEqual(oauth_client_for(stored), ('cid.apps.googleusercontent.com', 'GOCSPX-nuevo'))

    def test_other_client_keeps_its_own_secret(self):
        stored = SimpleNamespace(client_id='otro.apps.googleusercontent.com', client_secret='GOCSPX-otro')
        self.assertEqual(oauth_client_for(stored), ('otro.apps.googleusercontent.com', 'GOCSPX-otro'))

    @override_settings(GOOGLE_CLIENT_SECRET='')
    def test_without_env_secret_falls_back_to_stored(self):
        stored = SimpleNamespace(client_id='cid.apps.googleusercontent.com', client_secret='GOCSPX-guardado')
        self.assertEqual(oauth_client_for(stored)[1], 'GOCSPX-guardado')
