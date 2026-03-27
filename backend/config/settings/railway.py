"""
Railway-specific production settings
This file extends production.py with Railway-specific configurations.
All sensitive values (hosts, origins, keys) deben venir de variables de entorno en Railway.
"""
from .production import *
import os

# Railway provides the PORT environment variable
PORT = os.environ.get('PORT', '8000')

# ALLOWED_HOSTS — completamente desde variables de entorno (Railway Variables)
# La variable ALLOCORS_ALLOWED_ORIGINSWED_HOSTS en Railway debe contener los hosts separados por coma.
# base.py ya lee ALLOWED_HOSTS del entorno vía get_allowed_hosts().
# Solo se añaden aquí los comodines de Railway que no exponen nada sensible.
_extra_hosts = []

railway_public_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN', '')
if railway_public_domain:
    _extra_hosts.append(railway_public_domain)

railway_private_domain = os.environ.get('RAILWAY_PRIVATE_DOMAIN', '')
if railway_private_domain:
    _extra_hosts.append(railway_private_domain)

env_allowed_hosts = os.environ.get('ALLOWED_HOSTS', '')
if env_allowed_hosts:
    _extra_hosts.extend([h.strip() for h in env_allowed_hosts.split(',') if h.strip()])

# Combinar con los hosts base (ya calculados en base.py) y eliminar duplicados
ALLOWED_HOSTS = list(dict.fromkeys(ALLOWED_HOSTS + _extra_hosts))

# CORS — completamente desde variables de entorno
CORS_ALLOWED_ORIGINS = []

frontend_url = os.environ.get('FRONTEND_URL', '')
if frontend_url:
    CORS_ALLOWED_ORIGINS.append(frontend_url)

if railway_public_domain:
    CORS_ALLOWED_ORIGINS.append(f"https://{railway_public_domain}")

cors_origins_env = os.environ.get('CORS_ALLOWED_ORIGINS', '')
if cors_origins_env:
    for origin in cors_origins_env.split(','):
        origin = origin.strip()
        if origin and origin not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(origin)

# Static / Media
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_ROOT = BASE_DIR / 'mediafiles'
if frontend_url and frontend_url.startswith('https://'):
    MEDIA_URL = f'{frontend_url}/media/'
else:
    MEDIA_URL = '/media/'

# S3 — desde variables de entorno
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')

if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME', 'mh-soluciones-media')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'us-east-2')
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {'CacheControl': 'max-age=86400'}
    AWS_S3_FILE_OVERWRITE = False
    AWS_DEFAULT_ACL = None
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
else:
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'

# Redis / Celery / Channels — desde variables de entorno
REDIS_URL = os.environ.get('REDIS_URL')

if REDIS_URL:
    CELERY_BROKER_URL = REDIS_URL
    CELERY_RESULT_BACKEND = REDIS_URL
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [REDIS_URL]},
        },
    }
else:
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'},
    }

# Security
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

# CSRF_TRUSTED_ORIGINS — desde variables de entorno
CSRF_TRUSTED_ORIGINS = ["https://*.railway.app"]

if frontend_url:
    CSRF_TRUSTED_ORIGINS.append(frontend_url)

if railway_public_domain:
    CSRF_TRUSTED_ORIGINS.append(f"https://{railway_public_domain}")

csrf_origins_env = os.environ.get('CSRF_TRUSTED_ORIGINS', '')
if csrf_origins_env:
    for _origin in csrf_origins_env.split(','):
        _origin = _origin.strip()
        if _origin and _origin not in CSRF_TRUSTED_ORIGINS:
            CSRF_TRUSTED_ORIGINS.append(_origin)
