import os
import logging
from django.contrib.auth import get_user_model
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice
from ipware import get_client_ip
from rest_framework import status, viewsets, generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.core.cache import cache
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.parsers import MultiPartParser, FormParser
from django_otp import devices_for_user
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.shortcuts import redirect
from django.urls import reverse
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from django.db.models import Q
from rest_framework.filters import SearchFilter, OrderingFilter
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from datetime import timedelta

from apps.core.permissions import IsSuperAdmin, CanManageUsers
from apps.core.utils import (
    success_response, error_response, created_response,
    updated_response, deleted_response, validation_error_response,
    forbidden_response, unauthorized_response
)
from ..models import GoogleApiCredentials, CustomUser, LoginActivity
from .serializers import (
    LoginSerializer, 
    PasswordChangeSerializer,
    TwoFactorSerializer, 
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer
)

User = get_user_model()
logger = logging.getLogger(__name__)

if settings.DEBUG:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar usuarios.
    
    Permissions:
    - SUPERADMIN: Full CRUD access
    - ADMIN: Read-only access
    - Others: Cannot access
    """
    queryset = User.objects.all().order_by('first_name', 'last_name')
    filter_backends = [SearchFilter, OrderingFilter]
    search_fields = ['username', 'first_name', 'last_name', 'email']
    ordering_fields = ['first_name', 'last_name', 'email', 'created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            # ADMIN can read, but only SUPERADMIN can write
            self.permission_classes = [permissions.IsAuthenticated]
        else:
            # Only SUPERADMIN can create, update, delete users
            self.permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
        return super().get_permissions()
    
    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=['is_active'])
        return Response({'message': 'Usuario desactivado correctamente.'}, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperAdmin])
    def change_password(self, request, pk=None):
        """Change password for a user by superadmin"""
        user = self.get_object()
        new_password = request.data.get('new_password')
        
        if not new_password:
            return Response({'error': 'La nueva contraseña es requerida.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(new_password) < 8:
            return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()
        
        return Response({'message': 'Contraseña actualizada correctamente.'}, status=status.HTTP_200_OK)

class UserProfileAPIView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        
        return UserSerializer


@method_decorator(ratelimit(key='ip', rate='5/m', method='POST'), name='dispatch')
class LoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        client_ip, _ = get_client_ip(request)
        
        # Verificar si la cuenta está bloqueada
        if user.is_account_locked():
            LoginActivity.objects.create(
                user=user, 
                ip_address=client_ip, 
                successful=False,
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )
            return Response(
                {
                    'error': 'Cuenta bloqueada temporalmente por múltiples intentos fallidos. '
                    f'Intente nuevamente después de {user.account_locked_until.strftime("%H:%M")}.'
                }, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verificar si se requiere cambio de contraseña
        if user.force_password_change or user.is_password_expired():
            return Response(
                {
                    'error': 'Su contraseña ha expirado. Debe cambiarla antes de continuar.',
                    'requires_password_change': True,
                    'user_pk': user.pk
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verificar IPs permitidas
        if user.allowed_ips:
            allowed_ips = [ip.strip() for ip in user.allowed_ips.split(',')]
            if client_ip not in allowed_ips and client_ip != '127.0.0.1':
                user.increment_failed_login()
                LoginActivity.objects.create(
                    user=user, 
                    ip_address=client_ip, 
                    successful=False,
                    user_agent=request.META.get('HTTP_USER_AGENT', '')
                )
                return Response(
                    {'error': 'Acceso no autorizado desde esta IP'}, 
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Login exitoso - resetear intentos fallidos
        user.reset_failed_login()
        user.last_login = timezone.now()
        user.last_login_ip = client_ip
        user.last_activity = timezone.now()
        user.save(update_fields=['last_login', 'last_login_ip', 'last_activity'])
        
        LoginActivity.objects.create(
            user=user, 
            ip_address=client_ip, 
            successful=True, 
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        if user.requires_2fa:
            device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
            if device:
                return Response({
                    'message': 'Código de verificación requerido.', 
                    'requires_2fa': True, 
                    'user_pk': user.pk
                }, status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)
        user_data = UserSerializer(user, context={'request': request}).data
        
        return Response({
            'refresh': str(refresh), 
            'access': str(refresh.access_token), 
            'user': user_data
        }, status=status.HTTP_200_OK)


class TwoFactorVerifyAPIView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    serializer_class = TwoFactorSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        client_ip, _ = get_client_ip(request)
        user.last_login = timezone.now()
        user.last_login_ip = client_ip
        user.save(update_fields=['last_login', 'last_login_ip'])
        LoginActivity.objects.create(
            user=user, 
            ip_address=client_ip, 
            successful=True, 
            user_agent=request.META.get('HTTP_USER_AGENT', '')
        )

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user, context={'request': request}).data
        }, status=status.HTTP_200_OK)


class PasswordChangeAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PasswordChangeSerializer
    
    def post(self, request, *args, **kwargs):
        user = request.user
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.password_changed_at = timezone.now()
        user.force_password_change = False
        user.save(update_fields=['password', 'password_changed_at', 'force_password_change'])
        return Response({"message": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)


class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, *args, **kwargs):
        user = request.user
        for device in devices_for_user(user):
            device.delete()
        
        device = TOTPDevice.objects.create(user=user, name='default', confirmed=False)
        provisioning_uri = device.config_url
        
        return Response({
            'provisioning_uri': provisioning_uri,
            'device_pk': device.pk
        }, status=status.HTTP_200_OK)


class TwoFactorConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request, *args, **kwargs):
        user = request.user
        token = request.data.get('otp_token')
        device_pk = request.data.get('device_pk')

        if not all([token, device_pk]):
            return Response({'error': 'Faltan parámetros requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            device = TOTPDevice.objects.get(pk=device_pk, user=user, confirmed=False)
        except TOTPDevice.DoesNotExist:
            return Response({'error': 'Dispositivo 2FA inválido o ya confirmado.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if device.verify_token(token):
            device.confirmed = True
            device.save()
            user.requires_2fa = True
            user.save(update_fields=['requires_2fa'])
            return Response({'message': '2FA configurado exitosamente.'}, status=status.HTTP_200_OK)
        
        return Response({'error': 'El código de verificación es inválido.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_view(request):
    serializer = UserSerializer(request.user, context={'request': request})
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user_from_session(request):
    serializer = UserSerializer(request.user)
    return Response(serializer.data)

class ClientListView(generics.ListAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CustomUser.objects.filter(is_active=True, role='CLIENT')
    

class GoogleAuthRedirectView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/auth/google/callback/"
            
            # Validate Google OAuth configuration
            if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
                logger.error("Google OAuth: Client ID or Client Secret not configured")
                return Response(
                    {'error': 'Google OAuth is not properly configured'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            flow = Flow.from_client_config(
                client_config={
                    "web": {
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "project_id": "mhsoluciones",
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "redirect_uris": [redirect_uri]
                    }
                },
                scopes=['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive', 'openid'],
                redirect_uri=redirect_uri
            )
            authorization_url, state = flow.authorization_url(
                access_type='offline', prompt='consent', include_granted_scopes='true'
            )
            
            # Store user ID in cache with 5 minute timeout
            cache.set(state, request.user.id, timeout=300)
            logger.info(f"Google OAuth: Generated authorization URL for user {request.user.id}")
            
            return Response({'authorization_url': authorization_url})
        except Exception as e:
            logger.error(f"Google OAuth redirect error: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate Google authorization URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleAuthCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, *args, **kwargs):
        try:
            state = request.GET.get('state')
            
            if not state:
                logger.error("Google OAuth callback: No state parameter provided")
                return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=error_state")
            
            user_id = cache.get(state)

            if not user_id:
                logger.error(f"Google OAuth callback: State {state} not found in cache or expired")
                return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=error_state")

            try:
                user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                logger.error(f"Google OAuth callback: User {user_id} does not exist")
                return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=error_user")

            redirect_uri = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/auth/google/callback/"
            
            try:
                flow = Flow.from_client_config(
                    client_config={
                        "web": {
                            "client_id": settings.GOOGLE_CLIENT_ID,
                            "project_id": "mhsoluciones",
                            "client_secret": settings.GOOGLE_CLIENT_SECRET,
                            "redirect_uris": [redirect_uri],
                            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                            "token_uri": "https://oauth2.googleapis.com/token",
                            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                        }
                    },
                    scopes=['https://www.googleapis.com/auth/drive', 'openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
                    state=state,
                    redirect_uri=redirect_uri
                )
                
                full_url = request.build_absolute_uri()
                logger.info(f"Google OAuth callback: Fetching token for user {user_id}")
                
                # This is the critical call that can fail - add proper error handling
                flow.fetch_token(authorization_response=full_url)
                
                credentials = flow.credentials

                GoogleApiCredentials.objects.update_or_create(
                    user=user,
                    defaults={
                        'access_token': credentials.token,
                        'refresh_token': credentials.refresh_token,
                        'token_uri': credentials.token_uri,
                        'client_id': credentials.client_id,
                        'client_secret': credentials.client_secret,
                        'scopes': ' '.join(credentials.scopes),
                    }
                )
                
                logger.info(f"Google OAuth callback: Successfully saved credentials for user {user_id}")
                # Clear the state from cache after successful authentication
                cache.delete(state)
                
                return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=success")
                
            except Exception as e:
                logger.error(f"Google OAuth callback: Error during token exchange or credential save for user {user_id}: {str(e)}", exc_info=True)
                return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=error_token")
                
        except Exception as e:
            logger.error(f"Google OAuth callback: Unexpected error: {str(e)}", exc_info=True)
            return redirect(f"{settings.FRONTEND_URL}/profile?google_auth=error")


class GoogleConnectionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        is_connected = GoogleApiCredentials.objects.filter(user=request.user).exists()
        return Response({'is_connected': is_connected})