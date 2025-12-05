from .base import *
from .https_config import *
import os
import dj_database_url

DEBUG = False

SECURE_SSL_REDIRECT = True 
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

if 'DATABASE_URL' in os.environ:
    DATABASES = {
        'default': dj_database_url.config(
            conn_max_age=600,
            ssl_require=True,
            conn_health_checks=True,
        )
    }
else:
    raise Exception("DATABASE_URL no encontrada en variables de entorno")

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

AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    AWS_STORAGE_BUCKET_NAME = 'mh-soluciones-media'
    AWS_S3_REGION_NAME = 'us-east-2'
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
    print("⚠️ Credenciales AWS no encontradas - Usando almacenamiento local")
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

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

print("=" * 60)
print("🚀 CONFIGURACIÓN DE PRODUCCIÓN ACTIVADA")
print(f"🔧 DEBUG: {DEBUG}")
print(f"🔒 SSL_REDIRECT: {SECURE_SSL_REDIRECT}")
print(f"🗄️ Database: {'Configurada' if DATABASES['default'] else 'No configurada'}")
print(f"📦 S3 Storage: {'Activado' if AWS_ACCESS_KEY_ID else 'Desactivado'}")
print("=" * 60)