from django.urls import path, include
from rest_framework.routers import SimpleRouter
from django.views.decorators.csrf import csrf_exempt
import logging
import functools

logger = logging.getLogger('authentication.google_oauth')

def log_oauth_callback(view_func):
    """Wrapper to log OAuth callback reception before any processing"""
    @functools.wraps(view_func)
    def wrapped_view(request, *args, **kwargs):
        logger.info("=" * 60)
        logger.info("🎯 OAUTH CALLBACK HIT - Request received by Django")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Query params: {list(request.GET.keys())}")
        logger.info("=" * 60)
        return view_func(request, *args, **kwargs)
    return wrapped_view

from .views import (
    LoginAPIView,
    UserProfileAPIView,
    PasswordChangeAPIView,
    ForcePasswordChangeAPIView,
    TwoFactorSetupView,
    TwoFactorConfirmView,
    TwoFactorVerifyAPIView,
    UserViewSet,
    current_user_view,
    ClientListView,
    GoogleAuthRedirectView,
    GoogleAuthCallbackView,
    GoogleConnectionStatusView,
    GoogleOAuthDebugView,
    forgot_password,
    BlockedIPViewSet,
    LogoutAPIView,
    CookieTokenRefreshView,
    LoginActivityListView
)

router = SimpleRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'blocked-ips', BlockedIPViewSet, basename='blocked-ips')

# Prepare the OAuth callback view with decorators
# Applied in order: view -> logging wrapper -> CSRF exemption
google_callback_view = csrf_exempt(log_oauth_callback(GoogleAuthCallbackView.as_view()))

urlpatterns = [
    path('', include(router.urls)),
    path('login/', LoginAPIView.as_view(), name='auth_login'),
    path('logout/', LogoutAPIView.as_view(), name='auth_logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('forgot-password/', forgot_password, name='forgot-password'),
    path('profile/', UserProfileAPIView.as_view(), name='auth_profile'),
    path('profile/change-password/', PasswordChangeAPIView.as_view(), name='auth_change_password'),
    path('force-change-password/', ForcePasswordChangeAPIView.as_view(), name='auth_force_change_password'),
    path('2fa-setup/', TwoFactorSetupView.as_view(), name='auth_2fa_setup'),
    path('2fa-confirm/', TwoFactorConfirmView.as_view(), name='auth_2fa_confirm'),
    path('2fa-verify/', TwoFactorVerifyAPIView.as_view(), name='auth_2fa_verify'),
    path('user-from-session/', current_user_view, name='current_user'),
    path('clients/', ClientListView.as_view(), name='client-list'),

    path('google/auth/', GoogleAuthRedirectView.as_view(), name='google-auth-redirect'),
    path('google/callback/', google_callback_view, name='google-auth-callback'),
    path('google/status/', GoogleConnectionStatusView.as_view(), name='google-status'),
    path('google/debug/', GoogleOAuthDebugView.as_view(), name='google-oauth-debug'),
    path('login-activity/', LoginActivityListView.as_view(), name='login-activity'),
]