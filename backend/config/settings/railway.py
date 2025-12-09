"""
Railway-specific production settings
This file extends production.py with Railway-specific configurations
"""
from .production import *
import os

# Railway provides the PORT environment variable
PORT = os.environ.get('PORT', '8000')

# Railway-specific allowed hosts
RAILWAY_STATIC_URL = os.environ.get('RAILWAY_STATIC_URL', '')
RAILWAY_PUBLIC_DOMAIN = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')

# Add Railway domains to allowed hosts
ALLOWED_HOSTS = [
    'app.mhsolucionesempresariales.com',
    'localhost',
    '127.0.0.1',
    '.railway.app',
]

if RAILWAY_PUBLIC_DOMAIN:
    ALLOWED_HOSTS.append(RAILWAY_PUBLIC_DOMAIN)

# Parse ALLOWED_HOSTS from environment if provided
env_allowed_hosts = os.environ.get('ALLOWED_HOSTS', '')
if env_allowed_hosts:
    ALLOWED_HOSTS.extend([h.strip() for h in env_allowed_hosts.split(',') if h.strip()])

# CORS settings for Railway
CORS_ALLOWED_ORIGINS = [
    "https://app.mhsolucionesempresariales.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# Add Railway frontend URL if configured
FRONTEND_URL = os.environ.get('FRONTEND_URL', '')
if FRONTEND_URL:
    if FRONTEND_URL not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(FRONTEND_URL)

# Add any Railway app domains
if RAILWAY_PUBLIC_DOMAIN:
    railway_origin = f"https://{RAILWAY_PUBLIC_DOMAIN}"
    if railway_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(railway_origin)

# Railway uses whitenoise for static files (no S3 required)
# Static files configuration for Railway
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files configuration for Railway
# Option 1: Local storage with Railway Volume (recommended for persistence)
# Option 2: Google Drive (existing integration)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'mediafiles'

# Check if AWS credentials are provided (for backward compatibility)
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    # Use S3 if credentials are provided
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'mh-soluciones-media')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-2')
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    print("📦 S3 Storage: Activado")
else:
    # Use local storage with whitenoise
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
    print("📁 Local Storage: Activado (Railway Volume recomendado)")

# Redis configuration for Railway
REDIS_URL = os.environ.get('REDIS_URL')

if REDIS_URL:
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
    
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [REDIS_URL],
            },
        },
    }
    print("🔴 Redis: Conectado")
else:
    # Fallback to in-memory channel layer
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        },
    }
    print("⚠️ Redis no configurado - usando InMemoryChannelLayer")

# Security settings
SECURE_SSL_REDIRECT = True
# Allow /health/ without HTTPS redirect (for Railway internal health checks)
SECURE_REDIRECT_EXEMPT = [r'^health/$']
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# CSRF trusted origins for Railway
CSRF_TRUSTED_ORIGINS = [
    "https://app.mhsolucionesempresariales.com",
    "https://*.railway.app",
]

if FRONTEND_URL:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

if RAILWAY_PUBLIC_DOMAIN:
    CSRF_TRUSTED_ORIGINS.append(f"https://{RAILWAY_PUBLIC_DOMAIN}")

print("=" * 60)
print("🚂 RAILWAY PRODUCTION CONFIGURATION")
print(f"🔧 DEBUG: {DEBUG}")
print(f"🌐 Allowed Hosts: {ALLOWED_HOSTS}")
print(f"🔒 SSL Redirect: {SECURE_SSL_REDIRECT}")
print(f"📊 Port: {PORT}")
print("=" * 60)
