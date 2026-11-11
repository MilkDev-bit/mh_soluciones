"""Aviso de Privacidad: se pide al primer inicio de sesión y se guarda la aceptación."""
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.authentication.models import PrivacyConsent

User = get_user_model()
URL = '/api/v1/auth/privacy-notice/'


@override_settings(PRIVACY_NOTICE_VERSION='v1')
class PrivacyNoticeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='ana', email='ana@x.com', password='x', role='STUDENT')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_new_user_has_not_accepted(self):
        self.assertFalse(self.client.get('/api/v1/auth/profile/').data['privacy_accepted'])
        self.assertFalse(self.client.get(URL).data['accepted'])

    def test_accept_is_saved_with_evidence_and_idempotent(self):
        res = self.client.post(URL, {'version': 'v1'}, format='json', HTTP_USER_AGENT='Firefox',
                               REMOTE_ADDR='10.0.0.5')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['accepted'])
        self.client.post(URL, {'version': 'v1'}, format='json')
        consent = PrivacyConsent.objects.get(user=self.user)
        self.assertEqual((consent.version, consent.ip_address, consent.user_agent), ('v1', '10.0.0.5', 'Firefox'))
        self.assertTrue(self.client.get('/api/v1/auth/profile/').data['privacy_accepted'])

    def test_outdated_version_is_rejected(self):
        res = self.client.post(URL, {'version': 'v0'}, format='json')
        self.assertEqual(res.status_code, 409)
        self.assertFalse(PrivacyConsent.objects.exists())

    def test_new_version_asks_again(self):
        self.client.post(URL, {'version': 'v1'}, format='json')
        with self.settings(PRIVACY_NOTICE_VERSION='v2'):
            self.assertFalse(self.client.get('/api/v1/auth/profile/').data['privacy_accepted'])

    def test_requires_login(self):
        self.assertIn(APIClient().get(URL).status_code, (401, 403))
