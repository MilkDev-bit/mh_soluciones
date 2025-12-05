from .base import *
from .https_config import *
import os
import dj_database_url

DEBUG = False

# Detect Railway environment
IS_RAILWAY = bool(os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RAILWAY_PROJECT_ID'))

SECURE_SSL_REDIRECT = True 
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Database configuration - supports both Railway PostgreSQL and AWS RDS
if 'DATABASE_URL' in os.environ:
    # Railway PostgreSQL may not require SSL, AWS RDS does
    ssl_require = not IS_RAILWAY  # Disable SSL requirement for Railway internal connections
    
    DATABASES = {
        'default': dj_database_url.config(
            conn_max_age=600,
            ssl_require=ssl_require,
            conn_health_checks=True,
        )
    }
else:
    raise Exception("DATABASE_URL no encontrada en variables de entorno")

# Redis configuration - supports both Railway Redis and AWS ElastiCache
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
    print("⚠️ REDIS_URL no encontrada - Celery y Channels no funcionarán")
    # Fallback to InMemory channel layer
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
frontend_url = os.environ.get('FRONTEND_URL', '')
if frontend_url and frontend_url not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(frontend_url)

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