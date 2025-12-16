from rest_framework.routers import SimpleRouter
from django.urls import path
from .views import NotificationViewSet, PushSubscriptionViewSet, get_vapid_public_key, send_push_notification

router = SimpleRouter()
router.register(r'', NotificationViewSet, basename='notification')
router.register(r'push/subscriptions', PushSubscriptionViewSet, basename='push-subscription')

urlpatterns = [
    path('push/vapid-public-key/', get_vapid_public_key, name='vapid-public-key'),
    path('push/send/', send_push_notification, name='send-push'),
] + router.urls