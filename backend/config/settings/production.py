from .base import *
from .https_config import *
import os
import dj_database_url

DEBUG = False

# Detect Railway environment
IS_RAILWAY = bool(os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RAILWAY_PROJECT_ID'))

# Cache commonly used environment variables
FRONTEND_URL = os.environ.get('FRONTEND_URL', '')

# Trust the X-Forwarded-Proto header from the proxy
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
USE_X_FORWARDED_PORT = True

# Disable SSL redirect - The proxy (Railway/ALB) handles SSL termination
# The internal connection from proxy to Django is HTTP, but the external connection is HTTPS
SECURE_SSL_REDIRECT = False

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Keep cookies secure
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Database configuration - supports both Railway PostgreSQL and AWS RDS
if 'DATABASE_URL' in os.environ:
    # SSL configuration can be overridden with DATABASE_SSL_REQUIRE environment variable
    # Default: Railway internal connections don't require SSL, AWS RDS does
    ssl_require_override = os.environ.get('DATABASE_SSL_REQUIRE')
    if ssl_require_override is not None:
        ssl_require = ssl_require_override.lower() in ('true', '1', 'yes')
    else:
        ssl_require = not IS_RAILWAY  # Railway internal network is secure by default
    
    DATABASES = {
        'default': dj_database_url.config(
            conn_max_age=0, # Reducido a 60s para evitar saturar el límite de conexiones en Railway
            ssl_require=ssl_require,
            conn_health_checks=True,
        )
    }
else:
    raise Exception("DATABASE_URL no encontrada en variables de entorno")

# Redis configuration - supports both Railway Redis and AWS ElastiCache
# IMPORTANT: REDIS_URL is required for production multi-instance deployments
if 'REDIS_URL' in os.environ:
    redis_url = os.environ.get('REDIS_URL')
    CELERY_BROKER_URL = redis_url
    CELERY_RESULT_BACKEND = redis_url
    
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {
                "hosts": [redis_url],
            },
        },
    }
else:
    # WARNING: InMemoryChannelLayer does not work across multiple instances
    # This is only suitable for single-instance deployments or development
    import warnings
    warnings.warn(
        "REDIS_URL not configured. Using InMemoryChannelLayer which does not work "
        "across multiple server instances. Configure REDIS_URL for production.",
        RuntimeWarning
    )
    print("⚠️ REDIS_URL no encontrada - Usando InMemoryChannelLayer (solo para una instancia)")
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer'
        },
    }

# Storage configuration
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    # S3 storage configuration (works for both AWS and Railway if S3 is used)
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'mh-soluciones-media')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-2')
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None

    STATIC_LOCATION = 'static'
    STATIC_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{STATIC_LOCATION}/'
    STATICFILES_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'

    MEDIA_LOCATION = 'media'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/{MEDIA_LOCATION}/'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
else:
    # Local/Whitenoise storage (Railway Volume or local filesystem)
    print("⚠️ Credenciales AWS no encontradas - Usando almacenamiento local con Whitenoise")
    STATIC_URL = '/static/'
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
    
    # Generate absolute HTTPS URL for media in production to avoid mixed content warnings
    # The X-Forwarded-Proto header tells Django the request came via HTTPS
    if FRONTEND_URL and FRONTEND_URL.startswith('https://'):
        # Use the frontend domain for media URLs (served via same proxy)
        MEDIA_URL = f'{FRONTEND_URL}/media/'
    else:
        # Fallback to relative URL - will use request's protocol via SECURE_PROXY_SSL_HEADER
        MEDIA_URL = '/media/'
    
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# Trusted origins for CSRF - important for Railway
CSRF_TRUSTED_ORIGINS = [
    'https://app.mhsolucionesempresariales.com',
]

# Add Railway domains to trusted origins
if IS_RAILWAY:
    railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN')
    if railway_domain:
        CSRF_TRUSTED_ORIGINS.append(f'https://{railway_domain}')
    # Generic Railway domains
    CSRF_TRUSTED_ORIGINS.extend([
        'https://*.railway.app',
        'https://*.up.railway.app',
    ])

# Add FRONTEND_URL to trusted origins
if FRONTEND_URL and FRONTEND_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# Print configuration status
platform = "🚂 Railway" if IS_RAILWAY else "☁️ AWS"
print("=" * 60)
print(f"🚀 CONFIGURACIÓN DE PRODUCCIÓN ACTIVADA ({platform})")
print(f"🔧 DEBUG: {DEBUG}")
print(f"🔒 SSL_REDIRECT: {SECURE_SSL_REDIRECT}")
print(f"🗄️ Database: {'Configurada' if DATABASES['default'] else 'No configurada'}")
print(f"📦 Storage: {'S3' if AWS_ACCESS_KEY_ID else 'Whitenoise/Local'}")
print(f"📡 Redis: {'Configurado' if 'REDIS_URL' in os.environ else 'InMemory'}")
print("=" * 60)