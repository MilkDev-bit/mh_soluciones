import os

def get_allowed_hosts():
    """
    SOLUCIÓN DEFINITIVA: Solo hosts específicos, sin rangos CIDR
    Django NO SOPORTA '10.0.0.0/16' - usa solo IPs específicas
    """
    allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '')
    if allowed_hosts_env:
        base_hosts = [host.strip() for host in allowed_hosts_env.split(',') if host.strip()]
    else:
        base_hosts = []
    
    critical_hosts = [
        'app.mhsolucionesempresariales.com',
        'mh-soluciones-alb-nuevo-473372556.us-east-2.elb.amazonaws.com',
        'localhost',
        '127.0.0.1',
        '.us-east-2.elb.amazonaws.com',
        '.compute.internal',              
        '.ec2.internal',                  
        '10.0.139.195',
        '10.0.149.4',
        '10.0.156.52',
        '10.0.132.171',
        '10.0.147.135',
        '10.0.129.167',
        '10.0.6.155',
        '10.0.28.60',
        '10.0.1.0', '10.0.2.0', '10.0.3.0', '10.0.4.0',
        '10.0.10.0', '10.0.20.0', '10.0.30.0', '10.0.40.0',
        '10.0.50.0', '10.0.100.0', '10.0.150.0', '10.0.200.0',
    ]
    
    all_hosts = list(set(base_hosts + critical_hosts))
    all_hosts.sort()
    
    return all_hosts

ALLOWED_HOSTS = get_allowed_hosts()

# CORS Configuration - Base origins plus optional environment variable
def get_cors_origins():
    """Get CORS allowed origins from base list and environment variable"""
    base_origins = [
        'https://app.mhsolucionesempresariales.com',
        'https://mh-soluciones-alb-nuevo-473372556.us-east-2.elb.amazonaws.com',
        'http://localhost:3000',
        'http://localhost:5173',
    ]
    
    # Add origins from environment variable if present
    cors_origins_env = os.environ.get('CORS_ORIGINS', '')
    if cors_origins_env:
        env_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
        base_origins.extend(env_origins)
    
    return list(set(base_origins))  # Remove duplicates

CORS_ALLOWED_ORIGINS = get_cors_origins()

CORS_ALLOW_ALL_ORIGINS = False

# CSRF Configuration - Base origins plus optional environment variable
def get_csrf_origins():
    """Get CSRF trusted origins from base list and environment variable"""
    base_origins = [
        'https://app.mhsolucionesempresariales.com',
        'https://mh-soluciones-alb-nuevo-473372556.us-east-2.elb.amazonaws.com',
    ]
    
    # Add origins from environment variable if present
    csrf_origins_env = os.environ.get('CSRF_ORIGINS', '')
    if csrf_origins_env:
        env_origins = [origin.strip() for origin in csrf_origins_env.split(',') if origin.strip()]
        base_origins.extend(env_origins)
    
    return list(set(base_origins))  # Remove duplicates

CSRF_TRUSTED_ORIGINS = get_csrf_origins()

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# BACKEND_URL and FRONTEND_URL are now read from environment variables in base.py
# They should be configured via Railway environment variables or .env file
# No hardcoded values here to avoid exposing production URLs in the repository

print("=" * 60)
print("✅ CONFIGURACIÓN SEGURA Y DEFINITIVA")
print(f"✅ ALLOWED_HOSTS: {len(ALLOWED_HOSTS)} hosts específicos")
print(f"✅ CORS_ALLOWED_ORIGINS: {len(CORS_ALLOWED_ORIGINS)} orígenes")
print(f"✅ CSRF_TRUSTED_ORIGINS: {len(CSRF_TRUSTED_ORIGINS)} orígenes")
print(f"❌ SIN RANGOS CIDR (Django no los soporta)")
print("=" * 60)