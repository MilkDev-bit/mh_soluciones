from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginAPIView,
    UserProfileAPIView,
    PasswordChangeAPIView,
    TwoFactorSetupView,
    TwoFactorConfirmView,
    TwoFactorVerifyAPIView,
    UserViewSet,
    current_user_view,
    ClientListView,
    GoogleAuthRedirectView,
    GoogleAuthCallbackView,
    GoogleConnectionStatusView
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('', include(router.urls)),
    path('login/', LoginAPIView.as_view(), name='auth_login'),
    path('profile/', UserProfileAPIView.as_view(), name='auth_profile'),
    path('profile/change-password/', PasswordChangeAPIView.as_view(), name='auth_change_password'),
    path('2fa-setup/', TwoFactorSetupView.as_view(), name='auth_2fa_setup'),
    path('2fa-confirm/', TwoFactorConfirmView.as_view(), name='auth_2fa_confirm'),
    path('2fa-verify/', TwoFactorVerifyAPIView.as_view(), name='auth_2fa_verify'),
    path('user-from-session/', current_user_view, name='current_user'),
    path('clients/', ClientListView.as_view(), name='client-list'),

    path('google/auth/', GoogleAuthRedirectView.as_view(), name='google-auth-redirect'),
    path('google/callback/', GoogleAuthCallbackView.as_view(), name='google-auth-callback'),
    path('google/status/', GoogleConnectionStatusView.as_view(), name='google-status'),
]