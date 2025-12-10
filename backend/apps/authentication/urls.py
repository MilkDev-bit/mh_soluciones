from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api.views import (
    UserViewSet,
    LoginAPIView,
    TwoFactorVerifyAPIView,
    UserProfileAPIView,
    PasswordChangeAPIView,
    GoogleAuthRedirectView,
    GoogleAuthCallbackView
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')

urlpatterns = [
    path('login/', LoginAPIView.as_view(), name='api_login'),
    
    path('login/verify/', TwoFactorVerifyAPIView.as_view(), name='api_login_verify'),
    
    path('profile/', UserProfileAPIView.as_view(), name='api_profile'),
    
    path('profile/change-password/', PasswordChangeAPIView.as_view(), name='api_password_change'),

    path('google/auth/', GoogleAuthRedirectView.as_view(), name='google-auth-redirect'),

    path('google/callback/', GoogleAuthCallbackView.as_view(), name='google-auth-callback'),
    
    path('', include(router.urls)),
]