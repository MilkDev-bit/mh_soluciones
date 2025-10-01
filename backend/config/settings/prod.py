from .base import *
import os
import dj_database_url

DEBUG = False

ALLOWED_HOSTS = [os.environ.get('RAILWAY_PUBLIC_DOMAIN', 'localhost')]

DATABASES = {
    'default': dj_database_url.config(conn_max_age=600, ssl_require=False)
}

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

CSRF_TRUSTED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]
CORS_ALLOWED_ORIGINS = [f"https://{host}" for host in ALLOWED_HOSTS]

STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

CELERY_BROKER_URL = os.environ.get('REDIS_URL')
CELERY_RESULT_BACKEND = os.environ.get('REDIS_URL')