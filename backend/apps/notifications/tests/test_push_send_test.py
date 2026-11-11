"""Notificación push de prueba: códigos de error claros y sin desactivar de más."""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from pywebpush import WebPushException
from rest_framework.test import APIClient

from apps.notifications import push_utils
from apps.notifications.models import PushSubscription

User = get_user_model()
URL = '/api/v1/notifications/push/subscriptions/send_test/'


def push_error(status_code):
    response = mock.Mock(status_code=status_code, text=f'error {status_code}')
    return WebPushException(f'Push failed: {status_code}', response=response)


@mock.patch.object(push_utils.vapid_config, 'subject', 'mailto:a@x.com')
@mock.patch.object(push_utils.vapid_config, 'public_key', 'pub')
@mock.patch.object(push_utils.vapid_config, 'private_key', 'priv')
class SendTestPushTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@x.com', password='x', role='SUPERADMIN')
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def subscribe(self):
        return PushSubscription.objects.create(user=self.user, endpoint='https://fcm.googleapis.com/x',
                                               p256dh='k', auth='a')

    def test_without_subscription_returns_code(self):
        res = self.client.post(URL)
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['code'], 'no_subscription')

    def test_success(self):
        self.subscribe()
        with mock.patch.object(push_utils, 'webpush', return_value=mock.Mock(status_code=201)):
            res = self.client.post(URL)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 1)

    def test_temporary_failure_keeps_subscription_active(self):
        sub = self.subscribe()
        with mock.patch.object(push_utils, 'webpush', side_effect=push_error(500)):
            res = self.client.post(URL)
        self.assertEqual(res.status_code, 502)
        self.assertEqual(res.data['code'], 'push_failed')
        sub.refresh_from_db()
        self.assertTrue(sub.is_active)  # antes quedaba desactivada para siempre

    def test_vapid_mismatch_asks_to_resubscribe(self):
        sub = self.subscribe()
        with mock.patch.object(push_utils, 'webpush', side_effect=push_error(403)):
            res = self.client.post(URL)
        self.assertEqual(res.data['code'], 'resubscribe')
        self.assertEqual(res.data['failures'][0]['status'], 403)
        sub.refresh_from_db()
        self.assertTrue(sub.is_active)

    def test_gone_subscription_is_deactivated(self):
        sub = self.subscribe()
        with mock.patch.object(push_utils, 'webpush', side_effect=push_error(410)):
            res = self.client.post(URL)
        self.assertEqual(res.data['code'], 'resubscribe')
        sub.refresh_from_db()
        self.assertFalse(sub.is_active)
