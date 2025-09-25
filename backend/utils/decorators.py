from django.core.exceptions import PermissionDenied
from functools import wraps
from django.shortcuts import redirect

def role_required(allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if request.user.role in allowed_roles:
                return view_func(request, *args, **kwargs)
            raise PermissionDenied
        return _wrapped_view
    return decorator

def ip_restriction(view_func):
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        user = request.user
        if user.allowed_ips:
            client_ip = request.META.get('REMOTE_ADDR')
            if client_ip not in user.allowed_ips.split(','):
                return redirect('access_denied')
        return view_func(request, *args, **kwargs)
    return _wrapped_view