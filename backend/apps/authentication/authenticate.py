from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from rest_framework import exceptions

class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom authentication class that reads the JWT from a cookie.
    """
    def authenticate(self, request):
        header = self.get_header(request)
        
        if header is None:
            raw_token = request.COOKIES.get(settings.SIMPLE_JWT['AUTH_COOKIE']) or None
        else:
            raw_token = self.get_raw_token(header)

        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except exceptions.AuthenticationFailed:
            return None

        user = self.get_user(validated_token)
        
        # Enforce CSRF validation for cookie-based authentication
        if header is None:
            self.enforce_csrf(request, user)
            
        return user, validated_token

    def enforce_csrf(self, request, user=None):
        """
        Enforce CSRF validation for session-like authentication.
        """
        from rest_framework.authentication import CSRFCheck
        
        def dummy_get_response(request):
            return None
        
        check = CSRFCheck(dummy_get_response)
        # populates request.META['CSRF_COOKIE']
        check.process_view(request, None, (), {})
        reason = check.process_view(request, None, (), {})
        if reason:
            # CSRF failed, raise a 403 error.
            import logging
            logger = logging.getLogger(__name__)
            # No usar request.user aquí: estamos dentro de la autenticación y
            # acceder a request.user vuelve a llamar a authenticate() → recursión
            # infinita y un 500 en lugar del 403 esperado.
            logger.warning(f"CSRF Validation Failed for user {user}: {reason}")
            raise exceptions.PermissionDenied('CSRF Failed: %s' % reason)
