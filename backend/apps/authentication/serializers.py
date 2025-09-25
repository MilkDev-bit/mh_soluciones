from django.contrib.auth import authenticate, get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from .models import CustomUser

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializador para mostrar y actualizar la información de un usuario.
    """
    class Meta:
        model = CustomUser
        fields = (
            'id', 'username', 'email', 'first_name', 'last_name', 'role',
            'profile_picture', 'is_active', 'last_login', 'allowed_ips', 'requires_2fa'
        )
        read_only_fields = ('id', 'last_login')


class UserCreateSerializer(serializers.ModelSerializer):
    """
    Serializador para que un Super Administrador cree nuevos usuarios.
    Maneja la creación y el hasheo correcto de la contraseña.
    """
    class Meta:
        model = CustomUser
        fields = (
            'username', 'email', 'first_name', 'last_name', 'role', 'password',
            'allowed_ips', 'requires_2fa'
        )
        extra_kwargs = {
            'password': {'write_only': True, 'style': {'input_type': 'password'}}
        }

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user


class LoginSerializer(serializers.Serializer):
    """
    Serializador para el proceso de inicio de sesión.
    No está ligado a un modelo, solo valida las credenciales.
    """
    username = serializers.CharField(label=_("Username"), write_only=True)
    password = serializers.CharField(
        label=_("Password"),
        style={'input_type': 'password'},
        trim_whitespace=False,
        write_only=True
    )

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        request = self.context.get('request')

        if not (username and password):
            raise serializers.ValidationError(
                _('Debes incluir "usuario" y "contraseña".'),
                code='authorization'
            )

        user = authenticate(request=request, username=username, password=password)

        if not user:
            raise serializers.ValidationError(
                _('No se puede iniciar sesión con las credenciales proporcionadas.'),
                code='authorization'
            )
        
        if not user.is_active:
            raise serializers.ValidationError(
                _('La cuenta de usuario está desactivada.'),
                code='authorization'
            )
        
        attrs['user'] = user
        return attrs


class TwoFactorSerializer(serializers.Serializer):
    """
    Serializador para verificar el código de 2FA.
    """
    user_pk = serializers.IntegerField(write_only=True)
    otp_token = serializers.CharField(
        max_length=6,
        min_length=6,
        write_only=True,
        required=True,
        label=_("Código de Verificación")
    )


class PasswordChangeSerializer(serializers.Serializer):
    """
    Serializador para que un usuario autenticado cambie su propia contraseña.
    """
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("La contraseña actual es incorrecta."))
        return value