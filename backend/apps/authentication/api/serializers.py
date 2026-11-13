from django.conf import settings
from django.contrib.auth import authenticate
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework import serializers

from ..models import CustomUser, LoginActivity, BlockedIP


class UserSerializer(serializers.ModelSerializer):
    """
    Serializador para MOSTRAR la información del usuario.
    """
    profile_picture = serializers.SerializerMethodField()
    # ¿Aceptó la versión vigente del Aviso de Privacidad? (si no, el frontend
    # lo muestra antes de dejar usar la aplicación)
    privacy_accepted = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'profile_picture', 'is_active', 'last_login',
            'allowed_ips', 'requires_2fa', 'privacy_accepted',
        )
        read_only_fields = ('last_login',)

    def get_privacy_accepted(self, obj):
        version = getattr(settings, 'PRIVACY_NOTICE_VERSION', None)
        if not version:
            return True
        return obj.privacy_consents.filter(version=version).exists()

    def get_profile_picture(self, obj):
        """
        Genera la URL absoluta para la imagen de perfil.
        """
        if obj.profile_picture and hasattr(obj.profile_picture, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            base_url = getattr(settings, 'BACKEND_URL', 'http://localhost:8000')
            return f"{base_url.rstrip('/')}{obj.profile_picture.url}"
        return None

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    Serializador específico para ACTUALIZAR el perfil del usuario,
    permitiendo la escritura de la imagen de perfil.
    """
    class Meta:
        model = CustomUser
        fields = ('first_name', 'last_name', 'email', 'profile_picture')

class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializador para crear nuevos usuarios desde el panel de administración.
    """
    class Meta:
        model = CustomUser
        fields = (
            'username', 'email', 'first_name', 'last_name',
            'role', 'password', 'allowed_ips', 'requires_2fa',
        )
        extra_kwargs = {
            'password': {'write_only': True, 'style': {'input_type': 'password'}}
        }

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializador para el inicio de sesión de usuario (login).
    """
    username = serializers.CharField(label="Username", write_only=True)
    password = serializers.CharField(
        label="Password",
        style={'input_type': 'password'},
        trim_whitespace=False,
        write_only=True
    )

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        request = self.context.get('request')

        if not (username and password):
            raise serializers.ValidationError('Debe incluir "usuario" y "contraseña".', code='authorization')

        # Intentar obtener el usuario primero
        try:
            user_obj = CustomUser.objects.get(username=username)
            
            # Verificar si la cuenta está bloqueada antes de autenticar
            if user_obj.is_account_locked():
                raise serializers.ValidationError(
                    'Cuenta bloqueada temporalmente por múltiples intentos fallidos. '
                    'Intente nuevamente más tarde.',
                    code='account_locked'
                )
        except CustomUser.DoesNotExist:
            pass
        
        user = authenticate(request=request, username=username, password=password)

        if not user:
            # Incrementar intentos fallidos si el usuario existe
            try:
                user_obj = CustomUser.objects.get(username=username)
                user_obj.increment_failed_login()
            except CustomUser.DoesNotExist:
                pass
            
            raise serializers.ValidationError('No se puede iniciar sesión con las credenciales proporcionadas.', code='authorization')
        
        if not user.is_active:
            raise serializers.ValidationError('La cuenta de usuario está desactivada.', code='authorization')
        
        attrs['user'] = user
        return attrs


class TwoFactorSerializer(serializers.Serializer):
    """
    Serializador para verificar el código de 2FA.
    """
    user_pk = serializers.IntegerField(write_only=True)
    otp_token = serializers.CharField(
        label="OTP Token",
        max_length=6,
        min_length=6,
        write_only=True,
        required=True
    )

    def validate(self, attrs):
        user_pk = attrs.get('user_pk')
        otp_token = attrs.get('otp_token')

        try:
            user = CustomUser.objects.get(pk=user_pk)
            device = TOTPDevice.objects.filter(user=user, confirmed=True).first()
            
            if not device or not device.verify_token(otp_token):
                raise serializers.ValidationError({'error': 'El código de verificación es inválido.'}, code='authorization')

        except CustomUser.DoesNotExist:
            raise serializers.ValidationError({'error': 'Sesión de verificación inválida.'}, code='authorization')
        
        attrs['user'] = user
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=8)
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"confirm_password": "Las contraseñas no coinciden."})
        return data


class ForgotPasswordSerializer(serializers.Serializer):
    """
    Serializer para solicitud de recuperación de contraseña.
    """
    email = serializers.EmailField(
        required=True,
        error_messages={
            'required': 'El correo electrónico es obligatorio.',
            'invalid': 'Ingresa un correo electrónico válido.'
        }
    )

    def validate_email(self, value):
        """
        Validar que el correo exista en la base de datos.
        """
        try:
            user = CustomUser.objects.get(email=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError(
                'No existe un usuario con este correo electrónico.'
            )
        
        # Store user temporarily for use in validate()
        self._user = user
        return value
    
    def validate(self, data):
        """
        Add the user to validated_data.
        """
        if hasattr(self, '_user'):
            data['user'] = self._user
        return data
    
class LoginActivitySerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    login_count_this_month = serializers.SerializerMethodField()

    class Meta:
        model = LoginActivity
        fields = (
            'id', 'user', 'username', 'first_name',
            'timestamp', 'ip_address', 'successful', 'user_agent',
            'login_count_this_month'
        )

    def get_login_count_this_month(self, obj):
        from django.utils import timezone
        cache = self.context.setdefault('_monthly_counts', {})
        user_id = obj.user_id
        if user_id not in cache:
            now = timezone.now()
            cache[user_id] = LoginActivity.objects.filter(
                user_id=user_id,
                successful=True,
                timestamp__year=now.year,
                timestamp__month=now.month,
            ).count()
        return cache[user_id]

class BlockedIPSerializer(serializers.ModelSerializer):
    time_since_blocked = serializers.SerializerMethodField()

    class Meta:
        model = BlockedIP
        fields = [
            'id', 
            'ip_address', 
            'reason', 
            'created_at',
            'is_active',
            'expires_at',
            'time_since_blocked'
        ]
        read_only_fields = ['created_at']

    def get_time_since_blocked(self, obj):
        from django.utils import timezone
        now = timezone.now()
        diff = now - obj.created_at
        
        if diff.days > 0:
            return f"Hace {diff.days} días"
        hours = diff.seconds // 3600
        if hours > 0:
            return f"Hace {hours} horas"
        minutes = (diff.seconds // 60) % 60
        return f"Hace {minutes} minutos"