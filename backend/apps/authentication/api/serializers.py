from django.contrib.auth import authenticate
from rest_framework import serializers
from django_otp.plugins.otp_totp.models import TOTPDevice
from ..models import CustomUser

class UserSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar la información del usuario.
    """
    profile_picture = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'profile_picture', 'is_active', 'last_login',
            'allowed_ips', 'requires_2fa',
        )
        read_only_fields = ('last_login',)

    def get_profile_picture(self, obj):
        """
        Genera la URL absoluta para la imagen de perfil.
        Esta es la corrección clave para que las imágenes funcionen en desarrollo.
        """
        if obj.profile_picture and hasattr(obj.profile_picture, 'url'):
            base_url = "http://localhost:8000"
            return f"{base_url}{obj.profile_picture.url}"
        return None


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

        user = authenticate(request=request, username=username, password=password)

        if not user:
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