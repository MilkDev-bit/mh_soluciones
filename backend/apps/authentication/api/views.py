import os
import logging
import socket
import time
from urllib.parse import urlencode, urlparse, parse_qs, urlunparse
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
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
from google.auth.exceptions import GoogleAuthError
from oauthlib.oauth2.rfc6749.errors import OAuth2Error
from django.db.models import Q
from django.db import DatabaseError
from rest_framework.filters import SearchFilter, OrderingFilter
from django_ratelimit.decorators import ratelimit
from django.utils.decorators import method_decorator
from datetime import timedelta
from requests.exceptions import Timeout as RequestsTimeout

from apps.core.permissions import IsSuperAdmin, CanManageUsers
from apps.core.utils import (
    success_response, error_response, created_response,
    updated_response, deleted_response, validation_error_response,
    forbidden_response, unauthorized_response
)
from ..models import GoogleApiCredentials, CustomUser, LoginActivity
from ..constants import SENSITIVE_OAUTH_PARAMS, SENSITIVE_HEADERS
from .serializers import (
    LoginSerializer, 
    PasswordChangeSerializer,
    TwoFactorSerializer, 
    UserCreateSerializer,
    UserSerializer,
    UserUpdateSerializer,
    ForgotPasswordSerializer,
    LoginActivitySerializer
)

User = get_user_model()
logger = logging.getLogger('authentication.google_oauth')
forgot_password_logger = logging.getLogger('authentication.forgot_password')
user_logger = logging.getLogger('authentication.users')

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
    
    def list(self, request, *args, **kwargs):
        """
        Custom list method with explicit page_size handling and detailed logging.
        """
        # Get page_size from query params
        page_size_param = request.query_params.get('page_size')
        
        # Get base queryset
        queryset = self.filter_queryset(self.get_queryset())
        total_count = queryset.count()
        
        user_logger.info(f"📊 UserViewSet.list() called")
        user_logger.info(f"   Total users in queryset: {total_count}")
        user_logger.info(f"   page_size parameter: {page_size_param}")
        user_logger.info(f"   Query params: {dict(request.query_params)}")
        
        # If page_size is provided, use custom pagination
        if page_size_param:
            try:
                page_size = int(page_size_param)
                # Respect MAX_PAGE_SIZE from settings
                max_page_size = getattr(settings, 'REST_FRAMEWORK', {}).get('MAX_PAGE_SIZE', 1000)
                page_size = min(page_size, max_page_size)
                
                user_logger.info(f"   Requested page_size: {page_size_param}, Using: {page_size}")
                
                # Get page number
                page_number = int(request.query_params.get('page', 1))
                
                # Calculate pagination
                start = (page_number - 1) * page_size
                end = start + page_size
                
                # Get paginated results
                paginated_queryset = queryset[start:end]
                
                # Calculate actual result count without extra DB query
                result_count = len(paginated_queryset)
                
                user_logger.info(f"   Paginating: page={page_number}, start={start}, end={end}")
                user_logger.info(f"   Returning {result_count} users")
                
                # Serialize
                serializer = self.get_serializer(paginated_queryset, many=True)
                
                # Log first few user IDs for debugging
                user_ids = [u.id for u in paginated_queryset[:5]]
                user_logger.info(f"   First user IDs: {user_ids}")
                
                # Calculate next and previous page URLs
                has_next = end < total_count
                has_previous = page_number > 1
                
                next_url = None
                previous_url = None
                
                if has_next:
                    next_url = request.build_absolute_uri()
                    # Replace page parameter if it exists, otherwise add it
                    parsed = urlparse(next_url)
                    query_params = parse_qs(parsed.query)
                    query_params['page'] = [str(page_number + 1)]
                    new_query = urlencode(query_params, doseq=True)
                    next_url = urlunparse(parsed._replace(query=new_query))
                
                if has_previous:
                    previous_url = request.build_absolute_uri()
                    parsed = urlparse(previous_url)
                    query_params = parse_qs(parsed.query)
                    query_params['page'] = [str(page_number - 1)]
                    new_query = urlencode(query_params, doseq=True)
                    previous_url = urlunparse(parsed._replace(query=new_query))
                
                # Return paginated response
                return Response({
                    'count': total_count,
                    'next': next_url,
                    'previous': previous_url,
                    'results': serializer.data
                })
                
            except (ValueError, TypeError) as e:
                user_logger.error(f"   Error parsing page_size: {e}")
                # Fall through to default pagination
        
        # Default pagination via parent
        user_logger.info(f"   Using default DRF pagination")
        return super().list(request, *args, **kwargs)
    
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
        # ✅ Validate that only SUPERADMIN can initiate OAuth flow
        if request.user.role != 'SUPERADMIN':
            logger.warning(
                f"User {request.user.username} (role: {request.user.role}) "
                f"attempted to connect Google Drive but is not SUPERADMIN"
            )
            return Response(
                {
                    'error': 'Solo el SUPERADMIN puede conectar Google Drive institucional',
                    'detail': 'Esta funcionalidad está reservada para la cuenta institucional principal.'
                },
                status=status.HTTP_403_FORBIDDEN
            )
        
        try:
            # Build redirect URI pointing to FRONTEND callback page
            redirect_uri = f"{settings.FRONTEND_URL.rstrip('/')}/auth/google/callback"
            
            logger.info(f"Google OAuth: Using redirect URI: {redirect_uri}")
            
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
                        "project_id": settings.GOOGLE_PROJECT_ID,
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
            
            # Store user ID in cache with 10 minute timeout (increased from 5)
            cache.set(state, request.user.id, timeout=600)
            logger.info(f"Google OAuth: Generated authorization URL for user {request.user.id}, state stored in cache")
            
            return Response({'authorization_url': authorization_url})
        except Exception as e:
            logger.error(f"Google OAuth redirect error: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to generate Google authorization URL'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class GoogleOAuthDebugView(APIView):
    """Debug endpoint to test OAuth callback routing"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request, *args, **kwargs):
        logger.info("🧪 OAuth Debug endpoint hit successfully")
        
        # Filter sensitive query parameters using constants
        safe_query_params = {
            k: v if k not in SENSITIVE_OAUTH_PARAMS else '[REDACTED]'
            for k, v in request.GET.items()
        }
        logger.info(f"Query params (sanitized): {safe_query_params}")
        
        # Filter sensitive headers using constants
        safe_headers = {
            k: v if k.lower() not in SENSITIVE_HEADERS else '[REDACTED]'
            for k, v in request.headers.items()
        }
        logger.info(f"Headers (sanitized): {safe_headers}")
        
        return Response({
            'status': 'success',
            'message': 'OAuth debug endpoint working',
            'query_params_present': list(request.GET.keys()),
            'has_code': 'code' in request.GET,
            'has_state': 'state' in request.GET,
            'path': request.path,
            'method': request.method
        })


class GoogleAuthCallbackView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        start_time = time.time()
        try:
            # Validate request has data
            if not request.data:
                logger.error("❌ Google OAuth callback: Empty request body")
                return Response({
                    'success': False,
                    'error': 'Datos de solicitud faltantes',
                    'error_type': 'error_request'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get parameters from request body (JSON)
            state = request.data.get('state')
            error = request.data.get('error')
            authorization_code = request.data.get('code')
            
            logger.info(f"🎯 OAUTH CALLBACK START - POST request received")
            logger.info(f"Parameters present: code={bool(authorization_code)}, state={bool(state)}, error={error}")
            
            # Check if user denied access
            if error:
                logger.warning(f"❌ Google OAuth callback: User denied access or error occurred: {error}")
                return Response({
                    'success': False,
                    'error': 'Acceso denegado por el usuario',
                    'error_type': 'denied'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"⏱️ Step 1: Initial validation (elapsed: {time.time() - start_time:.2f}s)")
            
            if not state:
                logger.error("❌ Google OAuth callback: No state parameter provided")
                return Response({
                    'success': False,
                    'error': 'Parámetro de estado faltante',
                    'error_type': 'error_state'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Log only first 8 characters of state for security
            state_prefix = state[:8] if len(state) > 8 else state
            logger.info(f"🔑 State parameter received: {state_prefix}...")
            
            # Check for authorization code
            if not authorization_code:
                logger.error("❌ Google OAuth callback: No authorization code provided from Google")
                return Response({
                    'success': False,
                    'error': 'Código de autorización faltante',
                    'error_type': 'error_code'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate format of OAuth parameters (basic validation)
            # OAuth codes can include forward slashes, states are typically alphanumeric
            import re
            
            # State validation: alphanumeric, dots, hyphens, underscores (standard OAuth state)
            state_pattern = re.compile(r'^[A-Za-z0-9._-]+$')
            
            # Code validation: More permissive - allows forward slashes and other URL-safe characters
            # Google OAuth codes often start with patterns like "4/0..." which include slashes
            code_pattern = re.compile(r'^[A-Za-z0-9._\-/~%+:=]+$')
            
            if not state_pattern.match(str(state)):
                logger.error(f"❌ Google OAuth callback: Invalid state format")
                return Response({
                    'success': False,
                    'error': 'Formato de estado inválido',
                    'error_type': 'error_state'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if not code_pattern.match(str(authorization_code)):
                logger.error(f"❌ Google OAuth callback: Invalid authorization code format")
                logger.error(f"Code snippet: {authorization_code[:20]}...")  # Log first 20 chars for debugging
                return Response({
                    'success': False,
                    'error': 'Formato de código inválido',
                    'error_type': 'error_code'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"✅ Authorization code present: {authorization_code[:8]}...")
            
            logger.info(f"⏱️ Step 2: Validating state in cache (elapsed: {time.time() - start_time:.2f}s)")
            
            # Log cache backend type
            cache_backend = cache.__class__.__name__
            logger.info(f"Cache backend type: {cache_backend}")
            
            user_id = cache.get(state)

            if not user_id:
                # Enhanced cache debugging
                logger.error(f"❌ Google OAuth callback: State {state_prefix}... not found in cache")
                logger.error(f"Cache Backend: {cache_backend}")
                
                # Check if using LocMemCache (local memory) which won't work with multiple instances
                is_local_cache = 'LocMemCache' in cache_backend or 'locmem' in str(type(cache))
                logger.error(f"Is local cache (will fail with multiple instances): {is_local_cache}")
                
                return Response({
                    'success': False,
                    'error': 'La sesión de autenticación ha expirado. Por favor, intenta conectar nuevamente.',
                    'error_type': 'error_expired'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            logger.info(f"✅ Cache lookup successful - found user_id: {user_id}")
            logger.info(f"⏱️ Step 3: Cache validation complete (elapsed: {time.time() - start_time:.2f}s)")

            try:
                user = User.objects.get(pk=user_id)
                logger.info(f"✅ User verified: {user.username} (ID: {user_id})")
                
                # ✅ Validate that user is SUPERADMIN
                if user.role != 'SUPERADMIN':
                    logger.error(
                        f"❌ User {user.username} (role: {user.role}) "
                        f"is not SUPERADMIN but attempted to complete Google OAuth"
                    )
                    return Response({
                        'success': False,
                        'error': 'Solo el SUPERADMIN puede conectar Google Drive institucional',
                        'error_type': 'error_permissions'
                    }, status=status.HTTP_403_FORBIDDEN)
                
            except User.DoesNotExist:
                logger.error(f"❌ Google OAuth callback: User {user_id} does not exist")
                return Response({
                    'success': False,
                    'error': 'Usuario no encontrado',
                    'error_type': 'error_user'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Build redirect URI pointing to FRONTEND callback page
            redirect_uri = f"{settings.FRONTEND_URL.rstrip('/')}/auth/google/callback"
            
            logger.info(f"🔗 Redirect URI constructed: {redirect_uri}")
            
            # Log configuration status
            has_frontend_url = bool(settings.FRONTEND_URL)
            has_client_id = bool(getattr(settings, 'GOOGLE_CLIENT_ID', None))
            has_client_secret = bool(getattr(settings, 'GOOGLE_CLIENT_SECRET', None))
            logger.info(f"Configuration status - FRONTEND_URL: {'✅' if has_frontend_url else '❌'}, "
                       f"GOOGLE_CLIENT_ID: {'✅' if has_client_id else '❌'}, "
                       f"GOOGLE_CLIENT_SECRET: {'✅' if has_client_secret else '❌'}")
            
            logger.info(f"⏱️ Step 4: Exchanging authorization code for token (elapsed: {time.time() - start_time:.2f}s)")
            
            try:
                logger.info("Creating OAuth flow...")
                flow = Flow.from_client_config(
                    client_config={
                        "web": {
                            "client_id": settings.GOOGLE_CLIENT_ID,
                            "project_id": settings.GOOGLE_PROJECT_ID,
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
                logger.info("✅ OAuth flow created successfully")

                logger.info(f"🔄 Attempting to fetch token for user {user_id}...")
                
                # Construct authorization_response URL from code and state with proper URL encoding
                # This mimics the full callback URL that Google would have used
                query_params = urlencode({'code': authorization_code, 'state': state})
                authorization_response = f"{redirect_uri}?{query_params}"
                
                # Add timeout handling for token fetch
                old_timeout = socket.getdefaulttimeout()
                try:
                    # Use configurable timeout from settings (default 20s)
                    timeout = getattr(settings, 'GOOGLE_OAUTH_TOKEN_FETCH_TIMEOUT', 20)
                    socket.setdefaulttimeout(timeout)
                    fetch_start = time.time()
                    flow.fetch_token(authorization_response=authorization_response)
                    logger.info(f"✅ Token fetched successfully in {time.time() - fetch_start:.2f}s!")
                finally:
                    socket.setdefaulttimeout(old_timeout)
                
                logger.info(f"⏱️ Step 5: Token exchange complete (elapsed: {time.time() - start_time:.2f}s)")
                
                credentials = flow.credentials
                
                # Log refresh token status
                has_refresh_token = bool(credentials.refresh_token)
                logger.info(f"Token credentials obtained - Refresh token: {'✅ Present' if has_refresh_token else '❌ Not present'}")

                logger.info(f"⏱️ Step 6: Saving credentials to database (elapsed: {time.time() - start_time:.2f}s)")
                logger.info(f"💾 Saving credentials to database for user {user_id}...")
                
                db_start = time.time()
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
                logger.info(f"✅ Database save completed in {time.time() - db_start:.2f}s")
                
                logger.info(f"✅ Google OAuth callback: Successfully saved credentials for user {user_id}")
                # Clear the state from cache after successful authentication
                cache.delete(state)
                logger.info("🧹 State cleared from cache")
                
                total_time = time.time() - start_time
                logger.info(f"✅ OAUTH CALLBACK COMPLETE (total: {total_time:.2f}s)")
                
                # Performance warning if taking too long
                if total_time > 25:
                    logger.warning(f"⚠️ OAuth callback took {total_time:.2f}s - this is quite long!")
                
                return Response({
                    'success': True,
                    'message': 'Google Drive conectado exitosamente'
                }, status=status.HTTP_200_OK)
                
            except (socket.timeout, RequestsTimeout):
                elapsed = time.time() - start_time
                logger.error(f"❌ Timeout while fetching token for user {user_id} after {elapsed:.2f}s")
                logger.error(f"Debug Info: redirect_uri={redirect_uri}")
                return Response({
                    'success': False,
                    'error': 'Tiempo de espera agotado al obtener el token de Google',
                    'error_type': 'error_timeout'
                }, status=status.HTTP_504_GATEWAY_TIMEOUT)
            except (GoogleAuthError, OAuth2Error) as e:
                elapsed = time.time() - start_time
                logger.error(f"❌ Google OAuth callback: OAuth/Auth error for user {user_id} after {elapsed:.2f}s")
                logger.error(f"Error type: {type(e).__name__}, Error message: {str(e)}")
                logger.error(f"Debug Info: redirect_uri={redirect_uri}")
                logger.error(f"State: {state_prefix}..., Code present: {bool(authorization_code)}")
                return Response({
                    'success': False,
                    'error': f'Error de autenticación de Google: {str(e)}',
                    'error_type': 'error_token'
                }, status=status.HTTP_400_BAD_REQUEST)
            except DatabaseError as e:
                elapsed = time.time() - start_time
                logger.error(f"❌ Google OAuth callback: Database error saving credentials for user {user_id} after {elapsed:.2f}s")
                logger.error(f"Database error details: {str(e)}", exc_info=True)
                return Response({
                    'success': False,
                    'error': 'Error al guardar las credenciales en la base de datos',
                    'error_type': 'error_db'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            elapsed = time.time() - start_time
            logger.error(f"❌ Google OAuth callback: Unexpected error after {elapsed:.2f}s")
            logger.error(f"Exception type: {type(e).__name__}, Exception message: {str(e)}", exc_info=True)
            return Response({
                'success': False,
                'error': 'Error inesperado al procesar la autenticación',
                'error_type': 'error'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GoogleConnectionStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        is_connected = GoogleApiCredentials.objects.filter(user=request.user).exists()
        return Response({'is_connected': is_connected})


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def forgot_password(request):
    """
    Endpoint para solicitar recuperación de contraseña.
    Envía un correo a todos los SUPERADMIN notificando la solicitud.
    """
    serializer = ForgotPasswordSerializer(data=request.data)
    
    if not serializer.is_valid():
        # Extract the first error message safely
        email_errors = serializer.errors.get('email', [])
        error_message = str(email_errors[0]) if email_errors else 'Error de validación'
        return Response(
            {'detail': error_message},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user = serializer.validated_data.get('user')
    
    # Obtener todos los SUPERADMIN
    superadmins = User.objects.filter(role='SUPERADMIN', is_active=True)
    
    if not superadmins.exists():
        forgot_password_logger.error('No hay SUPERADMIN activos en el sistema')
        return Response(
            {'detail': 'No se pudo procesar la solicitud. Contacta al soporte técnico.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Preparar correo
    superadmin_emails = [admin.email for admin in superadmins if admin.email]
    
    if not superadmin_emails:
        forgot_password_logger.error('Los SUPERADMIN no tienen correos configurados')
        return Response(
            {'detail': 'No se pudo procesar la solicitud. Contacta al soporte técnico.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    subject = '🔐 Solicitud de Cambio de Contraseña - MH Soluciones'
    message = f"""
Hola Administrador,

El usuario con los siguientes datos ha solicitado un cambio de contraseña:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📧 Correo:        {user.email}
👤 Nombre:        {user.first_name} {user.last_name}
🆔 Usuario:       {user.username}
🎭 Rol:           {user.get_role_display()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por favor, realiza el cambio de contraseña desde el panel de administración de usuarios:
🔗 {settings.FRONTEND_URL}/admin/users

Pasos para cambiar la contraseña:
1. Inicia sesión en el panel de administración
2. Ve a "Gestión de Usuarios"
3. Busca al usuario "{user.username}"
4. Haz clic en el icono de llave (🔑) para cambiar la contraseña
5. Ingresa y confirma la nueva contraseña
6. Notifica al usuario por los canales oficiales

⚠️ IMPORTANTE:
- Verifica la identidad del usuario antes de proceder
- No compartas contraseñas por correo electrónico
- Instruye al usuario a cambiar su contraseña después del primer inicio de sesión

---
Este correo fue generado automáticamente por el sistema MH Soluciones.
Fecha y hora: {timezone.now().strftime('%d/%m/%Y %H:%M:%S')}
    """.strip()
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=superadmin_emails,
            fail_silently=False,
        )
        
        forgot_password_logger.info(
            f'Solicitud de cambio de contraseña enviada para {user.email}. '
            f'Notificados {len(superadmin_emails)} SUPERADMIN(s).'
        )
        
        return Response(
            {'detail': 'Solicitud enviada correctamente. Un administrador se pondrá en contacto contigo pronto.'},
            status=status.HTTP_200_OK
        )
        
    except Exception as e:
        forgot_password_logger.error(f'Error al enviar correo de recuperación: {str(e)}')
        return Response(
            {'detail': 'Error al enviar la solicitud. Por favor, intenta más tarde o contacta al soporte.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
class LoginActivityListView(generics.ListAPIView):
    serializer_class = LoginActivitySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['SUPERADMIN', 'ADMIN']:
            return LoginActivity.objects.all().order_by('-timestamp')
        return LoginActivity.objects.filter(user=user).order_by('-timestamp')