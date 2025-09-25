from django.contrib.auth import get_user_model
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice
from ipware import get_client_ip
from rest_framework import status, viewsets, generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import IsSuperAdmin
from .serializers import (LoginSerializer, PasswordChangeSerializer,
                        TwoFactorSerializer, UserCreateSerializer,
                        UserSerializer)
from ..models import LoginActivity

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """
    ViewSet para administrar usuarios (Crear, Leer, Actualizar, Eliminar).
    Solo los Super Administradores pueden acceder a estas vistas.
    """
    queryset = User.objects.all().order_by('first_name', 'last_name')
    permission_classes = [IsSuperAdmin]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer


class UserProfileAPIView(generics.RetrieveUpdateAPIView):
    """
    Vista para que un usuario vea y actualice su propio perfil.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class LoginAPIView(APIView):
    """
    Vista para el inicio de sesión.
    """
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        client_ip, _ = get_client_ip(request)

        if user.allowed_ips:
            allowed_ips_list = [ip.strip() for ip in user.allowed_ips.split(',')]
            if client_ip not in allowed_ips_list:
                LoginActivity.objects.create(user=user, ip_address=client_ip, successful=False, user_agent=request.META.get('HTTP_USER_AGENT', ''))
                return Response({'error': 'Acceso no permitido desde esta dirección IP.'}, status=status.HTTP_403_FORBIDDEN)
        
        user.last_login = timezone.now()
        user.last_login_ip = client_ip
        user.save(update_fields=['last_login', 'last_login_ip'])
        LoginActivity.objects.create(user=user, ip_address=client_ip, successful=True, user_agent=request.META.get('HTTP_USER_AGENT', ''))

        if user.requires_2fa:
            device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
            if device:
                return Response({
                    'message': 'Verification code required.',
                    'requires_2fa': True,
                    'user_pk': user.pk
                }, status=status.HTTP_200_OK)

        refresh = RefreshToken.for_user(user)
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class TwoFactorVerifyAPIView(APIView):
    """
    Vista para verificar el código OTP de 2FA.
    """
    permission_classes = [AllowAny]
    serializer_class = TwoFactorSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user_pk = serializer.validated_data['user_pk']
        otp_token = serializer.validated_data['otp_token']

        try:
            user = User.objects.get(pk=user_pk)
            device = TOTPDevice.objects.get(user=user, confirmed=True)
            
            if device.verify_token(otp_token):
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user': UserSerializer(user).data
                }, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'El código de verificación es inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        except (User.DoesNotExist, TOTPDevice.DoesNotExist):
            return Response({'error': 'Sesión de verificación inválida o usuario no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)


class PasswordChangeAPIView(generics.UpdateAPIView):
    """
    Vista para que un usuario cambie su propia contraseña.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = PasswordChangeSerializer

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        self.object = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        self.object.set_password(serializer.validated_data['new_password'])
        self.object.save()
        
        return Response({"message": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK)