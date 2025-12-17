import os
import logging
from pathlib import Path
from decouple import config
from datetime import timedelta
from celery.schedules import crontab

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)

# Detect Railway environment
IS_RAILWAY = bool(os.environ.get('RAILWAY_ENVIRONMENT') or os.environ.get('RAILWAY_PROJECT_ID'))

# Storage configuration - Default to local storage for Railway
# For S3/AWS storage, set the AWS environment variables
AWS_STORAGE_BUCKET_NAME = config('AWS_STORAGE_BUCKET_NAME', default='mh-soluciones-media')
AWS_S3_REGION_NAME = config('AWS_S3_REGION_NAME', default='us-east-2')
AWS_ACCESS_KEY_ID = config('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = config('AWS_SECRET_ACCESS_KEY', default='')

# Check if S3 credentials are available and not empty
USE_S3_STORAGE = bool(
    AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY and 
    AWS_ACCESS_KEY_ID.strip() and AWS_SECRET_ACCESS_KEY.strip()
)

if USE_S3_STORAGE:
    AWS_S3_CUSTOM_DOMAIN = f'{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com'
    AWS_S3_OBJECT_PARAMETERS = {
        'CacheControl': 'max-age=86400',
    }
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = False
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    MEDIA_URL = f'https://{AWS_S3_CUSTOM_DOMAIN}/media/'
else:
    # Use local storage (Railway Volume or Whitenoise)
    DEFAULT_FILE_STORAGE = 'django.core.files.storage.FileSystemStorage'
    MEDIA_URL = '/media/'

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'static']
MEDIA_ROOT = BASE_DIR / 'mediafiles'

def get_allowed_hosts():
    """Get allowed hosts based on environment"""
    hosts = [
        'app.mhsolucionesempresariales.com',
        'localhost',
        '127.0.0.1',
    ]
    
    # Add Railway domains
    if IS_RAILWAY:
        hosts.extend([
            '.railway.app',
            '.up.railway.app',
        ])
        # Add specific Railway domain if set
        railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN')
        if railway_domain:
            hosts.append(railway_domain)
    else:
        # AWS ECS hosts
        hosts.extend([
            '.elb.amazonaws.com',
            '.amazonaws.com',
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
        ])
    
    # Add custom ALLOWED_HOSTS from environment
    custom_hosts = config('ALLOWED_HOSTS', default='')
    if custom_hosts:
        hosts.extend([h.strip() for h in custom_hosts.split(',') if h.strip()])
    
    return hosts

ALLOWED_HOSTS = get_allowed_hosts()

if DEBUG:
    ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'daphne', 
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'django_otp',
    'django_otp.plugins.otp_totp',
    'drf_yasg',
    'storages',
    'apps.documents',
    'apps.core.apps.CoreConfig',
    'apps.authentication.apps.AuthenticationConfig',
    'apps.projects.apps.ProjectsConfig',
    'apps.tasks.apps.TasksConfig',
    'apps.hr.apps.HrConfig',
    'apps.reports.apps.ReportsConfig',
    'apps.calendar.apps.CalendarConfig',
    'apps.notifications.apps.NotificationsConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_otp.middleware.OTPMiddleware',
    'apps.authentication.security_middleware.SessionSecurityMiddleware',
    'apps.authentication.security_middleware.PasswordExpiryMiddleware',
]

ROOT_URLCONF = 'config.urls'

ASGI_APPLICATION = 'config.asgi.application'
WSGI_APPLICATION = 'config.wsgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'
    },
}

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {
        'context_processors': [
            'django.template.context_processors.debug',
            'django.template.context_processors.request',
            'django.contrib.auth.context_processors.auth',
            'django.contrib.messages.context_processors.messages',
        ],
    },
}]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ============================================
# CACHE CONFIGURATION
# ============================================

# Use Redis for caching in production/Railway to support multiple instances
# Use local memory cache for development

def get_cache_config():
    """
    Configure cache backend based on environment.
    
    For Railway/Production: Use Redis to share cache across multiple instances
    For Development: Use local memory cache
    
    Redis is REQUIRED for Google OAuth to work properly when using multiple
    backend instances, as the OAuth state must be shared across instances.
    """
    redis_url = config('REDIS_URL', default='')
    
    if redis_url:
        # Production: Use Redis (shared cache for multiple instances)
        logger.info("✅ Using Redis cache (shared across instances)")
        return {
            'default': {
                'BACKEND': 'django.core.cache.backends.redis.RedisCache',
                'LOCATION': redis_url,
                'OPTIONS': {
                    'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                    'CONNECTION_POOL_KWARGS': {
                        'max_connections': 50,
                        'retry_on_timeout': True,
                    },
                    'SOCKET_CONNECT_TIMEOUT': 5,
                    'SOCKET_TIMEOUT': 5,
                },
                'KEY_PREFIX': 'mhsoluciones',
                'TIMEOUT': 300,  # 5 minutes default
            }
        }
    else:
        # Development: Use local memory cache
        # WARNING: This will NOT work with multiple backend instances
        logger.warning("⚠️  Using local memory cache - OAuth may fail with multiple instances")
        return {
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'unique-snowflake',
                'OPTIONS': {
                    'MAX_ENTRIES': 1000
                }
            }
        }

CACHES = get_cache_config()

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
    {'NAME': 'apps.authentication.validators.StrongPasswordValidator'},
    {'NAME': 'apps.authentication.validators.CompromisedPasswordValidator'},
]

LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_L10N = True
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
AUTH_USER_MODEL = 'authentication.CustomUser'

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False

# Build CORS allowed origins based on environment
def get_cors_origins():
    """Get CORS allowed origins based on environment"""
    origins = [
        "https://app.mhsolucionesempresariales.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    
    # Add Railway frontend URL if available
    frontend_url = config('FRONTEND_URL', default='')
    if frontend_url and frontend_url not in origins:
        origins.append(frontend_url)
    
    # Add Railway public domain
    railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN')
    if railway_domain:
        origins.append(f"https://{railway_domain}")
    
    # Add custom CORS origins from environment variable (comma-separated)
    cors_origins_env = config('CORS_ORIGINS', default='')
    if cors_origins_env:
        env_origins = [origin.strip() for origin in cors_origins_env.split(',') if origin.strip()]
        origins.extend(env_origins)
    
    return list(set(origins))  # Remove duplicates

CORS_ALLOWED_ORIGINS = get_cors_origins()

# Build CSRF trusted origins based on environment
def get_csrf_origins():
    """Get CSRF trusted origins based on environment"""
    origins = [
        "https://app.mhsolucionesempresariales.com",
    ]
    
    # Add Railway frontend URL if available
    frontend_url = config('FRONTEND_URL', default='')
    if frontend_url and frontend_url not in origins:
        # CSRF trusted origins should be full URLs with scheme
        if not frontend_url.startswith('http'):
            frontend_url = f"https://{frontend_url}"
        origins.append(frontend_url)
    
    # Add Railway public domain
    railway_domain = os.environ.get('RAILWAY_PUBLIC_DOMAIN')
    if railway_domain:
        origins.append(f"https://{railway_domain}")
    
    # Add custom CSRF origins from environment variable (comma-separated)
    csrf_origins_env = config('CSRF_ORIGINS', default='')
    if csrf_origins_env:
        env_origins = [origin.strip() for origin in csrf_origins_env.split(',') if origin.strip()]
        origins.extend(env_origins)
    
    return list(set(origins))  # Remove duplicates

# Set CSRF_TRUSTED_ORIGINS for Django
CSRF_TRUSTED_ORIGINS = get_csrf_origins()

# Allow CORS from Railway subdomains when in Railway environment
if IS_RAILWAY:
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^https://.*\.railway\.app$",
        r"^https://.*\.up\.railway\.app$",
    ]


SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = False 
CSRF_COOKIE_SECURE = False     
SESSION_COOKIE_SAMESITE = 'Lax' 
CSRF_COOKIE_SAMESITE = 'Lax'  

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',),
    'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.IsAuthenticated',),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ) if not DEBUG else (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    )
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

EMAIL_BACKEND = config('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = config('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = config('EMAIL_PORT', default=587, cast=int)
EMAIL_USE_TLS = config('EMAIL_USE_TLS', default=True, cast=bool)
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='noreply@mhsoluciones.com')

JAZZMIN_SETTINGS = {
    "site_title": "MH Soluciones Admin",
    "site_header": "MH Soluciones",
    "site_brand": "MH Soluciones",
    "welcome_sign": "Bienvenido al administrador de MH Soluciones",
}
JAZZMIN_UI_TWEAKS = {
    "theme": "flatly",
}

FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:5173')
BACKEND_URL = config('BACKEND_URL', default='http://localhost:8000')
GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = config('GOOGLE_CLIENT_SECRET', default='')
GOOGLE_PROJECT_ID = config('GOOGLE_PROJECT_ID', default='mhsoluciones')
GOOGLE_DRIVE_ROOT_FOLDER_ID = config('GOOGLE_DRIVE_ROOT_FOLDER_ID', default='')

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
}

# Celery Beat Schedule for periodic tasks
CELERY_BEAT_SCHEDULE = {
    'send-task-due-reminders': {
        'task': 'apps.tasks.tasks.send_task_due_reminders',
        'schedule': crontab(hour=8, minute=0),  # Run daily at 8:00 AM
    },
    'verificar-recordatorios-vencimiento-tareas': {
        'task': 'verificar_recordatorios_vencimiento_tareas',
        'schedule': crontab(hour=9, minute=0),  # Ejecutar diariamente a las 9:00 AM
    },
    'verificar-tareas-vencidas': {
        'task': 'verificar_tareas_vencidas',
        'schedule': crontab(hour=10, minute=0),  # Ejecutar diariamente a las 10:00 AM
    },
    'verificar-recordatorios-eventos-calendario': {
        'task': 'verificar_recordatorios_eventos_calendario',
        'schedule': crontab(minute='*/30'),  # Ejecutar cada 30 minutos
    },
    'generar-resumen-actividad-diario': {
        'task': 'generar_resumen_actividad_diario',
        'schedule': crontab(hour=18, minute=0),  # Ejecutar diariamente a las 18:00
    },
    'generar-resumen-actividad-semanal': {
        'task': 'generar_resumen_actividad_semanal',
        'schedule': crontab(hour=9, minute=0, day_of_week=1),  # Ejecutar los lunes a las 9:00 AM
    },
    'limpiar-notificaciones-antiguas': {
        'task': 'limpiar_notificaciones_antiguas',
        'schedule': crontab(hour=2, minute=0, day_of_week=0),  # Ejecutar los domingos a las 2:00 AM
    },
}

# ============================================
# SECURITY SETTINGS - Enhanced for Production
# ============================================

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# HSTS (HTTP Strict Transport Security) - Enforce HTTPS
# En producción, estas deben estar habilitadas
# SECURE_HSTS_SECONDS = 31536000  # 1 año
# SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# SECURE_HSTS_PRELOAD = True
# SECURE_SSL_REDIRECT = True  # Redirigir HTTP a HTTPS

# Content Security Policy (CSP)
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'", "https://fonts.googleapis.com")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_CONNECT_SRC = ("'self'", "https:")

# Session Security
SESSION_COOKIE_AGE = 900  # 15 minutos
SESSION_SAVE_EVERY_REQUEST = True  # Renovar sesión en cada request
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# Rate Limiting Configuration
RATELIMIT_ENABLE = True
RATELIMIT_USE_CACHE = 'default'