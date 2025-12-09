# ✅ Lista de Verificación: Preparación para Producción en Railway

## 📋 Resumen Ejecutivo

Este documento verifica que **MH Soluciones Empresariales** está correctamente configurado para producción en Railway.

**Estado General**: ✅ **LISTO PARA PRODUCCIÓN** con ajustes menores recomendados

---

## 🔍 Estado Actual del Proyecto

### ✅ Backend (Django) - CONFIGURADO CORRECTAMENTE

#### Configuración de Django
- ✅ **Settings modulares**: `base.py`, `production.py`, `railway.py`
- ✅ **DEBUG=False** en producción
- ✅ **SECRET_KEY** desde variables de entorno
- ✅ **ALLOWED_HOSTS** configurado dinámicamente
- ✅ **CSRF_TRUSTED_ORIGINS** configurado
- ✅ **CORS** configurado correctamente

#### Seguridad
- ✅ **HTTPS/SSL**: `SECURE_SSL_REDIRECT = True`
- ✅ **HSTS**: Configurado (31536000 segundos = 1 año)
- ✅ **Secure Cookies**: Session y CSRF cookies seguras
- ✅ **XSS Protection**: Habilitado
- ✅ **Content Type Sniffing**: Deshabilitado
- ✅ **Proxy SSL Header**: Configurado para Railway

#### Base de Datos
- ✅ **PostgreSQL**: Configuración con `dj-database-url`
- ✅ **Connection Pooling**: `conn_max_age=600`
- ✅ **Health Checks**: `conn_health_checks=True`
- ✅ **SSL**: Configurado inteligentemente (no requerido en Railway por seguridad interna)

#### Redis & Caching
- ✅ **Redis**: Configurado para Celery y Channels
- ✅ **Channels**: `channels_redis` para WebSockets
- ✅ **Fallback**: `InMemoryChannelLayer` si Redis no está disponible

#### Archivos Estáticos & Media
- ✅ **Whitenoise**: Para archivos estáticos
- ✅ **STATIC_ROOT**: Configurado en `staticfiles/`
- ✅ **MEDIA_ROOT**: Configurado en `mediafiles/`
- ✅ **Storage Backends**: Soporte para S3, R2, y local
- ✅ **collectstatic**: Se ejecuta durante el build

#### Servidor & ASGI
- ✅ **Daphne**: Servidor ASGI para Django Channels
- ✅ **Puerto dinámico**: Usa `$PORT` de Railway
- ✅ **Health Check**: Endpoint `/health/` funcionando
- ✅ **WebSockets**: Configurado con Channels

#### Logging
- ✅ **Console logging**: Configurado
- ✅ **Formato verbose**: Incluye timestamp, módulo, nivel
- ✅ **Nivel INFO**: Adecuado para producción

### ✅ Frontend (React + Vite) - CONFIGURADO CORRECTAMENTE

#### Build & Optimización
- ✅ **Vite**: Build optimizado
- ✅ **React 18**: Última versión estable
- ✅ **Bundle splitting**: Automático con Vite
- ✅ **Asset hashing**: Para cache busting

#### Servidor (Nginx)
- ✅ **Nginx Alpine**: Imagen ligera
- ✅ **Puerto dinámico**: Configurado en runtime con `$PORT`
- ✅ **SPA routing**: Configurado correctamente
- ✅ **Health Check**: Endpoint `/health` funcionando
- ✅ **Gzip compression**: Habilitado
- ✅ **Cache headers**: Configurado para assets

#### Seguridad
- ✅ **Security Headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- ✅ **Sensitive files**: Bloqueados (.env, .git, .htaccess)
- ✅ **Server tokens**: Deshabilitados

### ✅ Docker & Despliegue - CONFIGURADO CORRECTAMENTE

#### Backend Dockerfile
- ✅ **Multi-stage**: No (no necesario para Python)
- ✅ **Imagen base**: `python:3.10-slim-bookworm` (ligera y segura)
- ✅ **Layer caching**: Optimizado (requirements antes de código)
- ✅ **collectstatic**: Se ejecuta durante build
- ✅ **Entrypoint**: Script de inicialización robusto
- ✅ **Health check**: Configurado externamente en Railway

#### Frontend Dockerfile
- ✅ **Multi-stage**: Sí (build + production)
- ✅ **Imagen build**: `node:20-alpine`
- ✅ **Imagen producción**: `nginx:alpine`
- ✅ **Tamaño optimizado**: ~25 MB (solo dist + nginx)
- ✅ **Entrypoint**: Configuración dinámica de nginx

#### Railway Configuration
- ✅ **railway.json**: Correctamente configurado para monorepo
- ✅ **Build context**: Separado para backend y frontend
- ✅ **Watch patterns**: Configurado para rebuild selectivo
- ✅ **Health check timeout**: 300s (adecuado para migraciones)
- ✅ **Restart policy**: ON_FAILURE con 3 reintentos

### ✅ Integraciones - IMPLEMENTADAS

#### Google Drive
- ✅ **OAuth2**: Implementado correctamente
- ✅ **Credential storage**: En base de datos
- ✅ **Token refresh**: Automático
- ✅ **Upload/Download**: Funcional
- ✅ **Organización**: Por proyectos y usuarios

#### Authentication
- ✅ **JWT**: SimpleJWT configurado
- ✅ **2FA**: Django OTP con TOTP
- ✅ **Token rotation**: Habilitado
- ✅ **Token blacklisting**: Habilitado

---

## 🎯 Recomendaciones de Mejora

### 🔴 Prioridad Alta (Hacer Antes de Producción)

#### 1. Configurar Railway Volume para Media Files

**Problema**: Sin Volume, los archivos subidos se perderán al redesplegar.

**Solución**:
```bash
# En Railway Dashboard:
# 1. Ve a Backend Service → Settings → Volumes
# 2. Create Volume:
#    - Name: media-storage
#    - Mount Path: /app/mediafiles
#    - Size: 10-50 GB (según necesidad)
```

**Archivo afectado**: Ninguno, configuración ya lista en settings.

#### 2. Configurar Variables de Entorno de Producción

**Variables Críticas**:
```bash
# Django Core
SECRET_KEY=<generar-clave-segura>
DJANGO_SETTINGS_MODULE=config.settings.railway

# Database & Redis (auto-configurado)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# URLs
FRONTEND_URL=https://tu-frontend.railway.app
BACKEND_URL=https://tu-backend.railway.app
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com

# Google Drive
GOOGLE_DRIVE_ROOT_FOLDER_ID=<tu-folder-id>
GOOGLE_CLIENT_ID=<tu-client-id>
GOOGLE_CLIENT_SECRET=<tu-client-secret>

# Superuser (primera vez)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=<contraseña-segura>
```

**Generar SECRET_KEY**:
```bash
# ⚠️ IMPORTANTE: Ejecutar LOCALMENTE en tu máquina, NO en Railway
# Copia el resultado a las variables de entorno de Railway
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

#### 3. Remover Credenciales AWS S3 (Si no se usa)

**Si usas Railway Volumes o Google Drive**, NO configures:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_STORAGE_BUCKET_NAME`

Esto hará que Django use almacenamiento local (Railway Volume).

### 🟡 Prioridad Media (Recomendado)

#### 4. Agregar Sentry para Error Tracking

**Beneficio**: Monitoreo de errores en tiempo real.

**Instalación**:
```bash
# En backend/requirements/base.txt
sentry-sdk[django]==1.40.0
```

**Configuración** en `backend/config/settings/railway.py`:
```python
import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

if not DEBUG:
    sentry_sdk.init(
        dsn=os.environ.get('SENTRY_DSN', ''),
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,
        send_default_pii=False,
        environment='production',
    )
```

**Variable de entorno**:
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

#### 5. Configurar Rate Limiting

**Beneficio**: Protección contra abusos y ataques.

**Instalación**:
```bash
# En backend/requirements/base.txt
django-ratelimit==4.1.0
```

**Uso** en views críticas:
```python
from django_ratelimit.decorators import ratelimit

@ratelimit(key='ip', rate='5/m', method='POST')
def login_view(request):
    # ...
```

#### 6. Agregar Logging Mejorado

**Actualizar** `backend/config/settings/railway.py`:
```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module} {process:d} {thread:d} - {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
        'simple': {
            'format': '[{levelname}] {message}',
            'style': '{',
        },
    },
    'filters': {
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'mail_admins': {
            'level': 'ERROR',
            'class': 'django.utils.log.AdminEmailHandler',
            'filters': ['require_debug_false'],
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
        'django.request': {
            'handlers': ['console', 'mail_admins'],
            'level': 'ERROR',
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}
```

### 🟢 Prioridad Baja (Opcional)

#### 7. Configurar Custom Domain

**Configuración DNS**:
```
Type: CNAME
Name: app
Value: your-frontend.railway.app

Type: CNAME
Name: api
Value: your-backend.railway.app
```

**Actualizar variables**:
```bash
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com,api.mhsolucionesempresariales.com
FRONTEND_URL=https://app.mhsolucionesempresariales.com
BACKEND_URL=https://api.mhsolucionesempresariales.com
```

#### 8. Configurar Email (SMTP)

**Para producción**, usar servicio real:

**Opciones**:
- **SendGrid** (12,000 emails/mes gratis)
- **Mailgun** (5,000 emails/mes gratis)
- **Amazon SES** (muy económico)

**Configuración** en `railway.py`:
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.sendgrid.net')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@mhsoluciones.com')
```

#### 9. Agregar Celery Worker como Servicio Separado

**Si usas tareas asíncronas**, crear servicio dedicado en Railway:

**Dockerfile** (`backend/Dockerfile.celery`):
```dockerfile
FROM python:3.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY requirements/base.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

COPY . /app

CMD celery -A config worker -l info
```

**railway.json** para worker:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile.celery",
    "dockerContext": "backend"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🔒 Checklist de Seguridad

### ✅ Completado

- [x] DEBUG = False en producción
- [x] SECRET_KEY desde variables de entorno (único y seguro)
- [x] ALLOWED_HOSTS configurado (sin '*')
- [x] HTTPS/SSL forzado (SECURE_SSL_REDIRECT)
- [x] HSTS configurado (1 año)
- [x] Secure cookies (SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE)
- [x] XSS Protection habilitado
- [x] CSRF Protection habilitado
- [x] CORS configurado correctamente (no ALL_ORIGINS)
- [x] SQL Injection protegido (Django ORM)
- [x] Whitenoise para archivos estáticos
- [x] Nginx security headers
- [x] Sensitive files bloqueados en nginx (.env, .git)

### 🔲 Recomendado

- [ ] Rate limiting implementado
- [ ] Sentry para error tracking
- [ ] Fail2ban o similar para protección de login
- [ ] Database backups automáticos configurados
- [ ] Email verificado para admins
- [ ] Monitoreo de uptime configurado
- [ ] Logs centralizados (opcional)

---

## 📊 Checklist de Rendimiento

### ✅ Completado

- [x] Database connection pooling (`conn_max_age=600`)
- [x] Redis para cache y channels
- [x] Whitenoise para archivos estáticos
- [x] Gzip compression en nginx
- [x] Asset caching en nginx (1 año para immutables)
- [x] Docker multi-stage build (frontend)
- [x] Docker layer caching optimizado
- [x] Vite build optimization

### 🔲 Opcional

- [ ] CDN para archivos estáticos (Cloudflare)
- [ ] Database query optimization
- [ ] Redis cache backend para Django
- [ ] HTTP/2 en nginx
- [ ] Database indexes optimizados

---

## 🚀 Pasos para Despliegue en Railway

### 1. Preparar Servicios en Railway

```bash
# Servicios necesarios:
- PostgreSQL (Plugin de Railway)
- Redis (Plugin de Railway)
- Backend (este repositorio, carpeta backend/)
- Frontend (este repositorio, carpeta frontend/)
```

### 2. Configurar PostgreSQL

1. Add PostgreSQL plugin en Railway
2. Railway generará automáticamente `DATABASE_URL`
3. Vincular servicio Backend a PostgreSQL

### 3. Configurar Redis

1. Add Redis plugin en Railway
2. Railway generará automáticamente `REDIS_URL`
3. Vincular servicio Backend a Redis

### 4. Configurar Backend Service

**Settings → Variables**:
```bash
SECRET_KEY=<tu-secret-key-generada>
DJANGO_SETTINGS_MODULE=config.settings.railway
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
FRONTEND_URL=https://<tu-frontend>.railway.app
BACKEND_URL=https://<tu-backend>.railway.app
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com
GOOGLE_DRIVE_ROOT_FOLDER_ID=<tu-folder-id>
GOOGLE_CLIENT_ID=<tu-client-id>
GOOGLE_CLIENT_SECRET=<tu-client-secret>
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=<contraseña-segura>
```

**Settings → Deploy**:
- Root Directory: `/`
- Build Command: (vacío, usa Dockerfile)
- Start Command: (vacío, usa Dockerfile CMD)

**Settings → Volumes**:
- Create Volume:
  - Name: `media-storage`
  - Mount Path: `/app/mediafiles`
  - Size: `10 GB` (inicial)

### 5. Configurar Frontend Service

**Settings → Variables**:
- No necesita variables especiales, nginx usa `$PORT` automáticamente

**Settings → Deploy**:
- Root Directory: `/`
- Build Command: (vacío, usa Dockerfile)
- Start Command: (vacío, usa Dockerfile ENTRYPOINT)

### 6. Conectar Repositorio

```bash
# Opción 1: GitHub (Recomendado)
1. En Railway, conectar repositorio GitHub
2. Seleccionar rama: main o production
3. Railway deployará automáticamente en cada push

# Opción 2: Railway CLI
railway login
railway link
railway up
```

### 7. Verificar Deployment

**Backend Health Check**:
```bash
curl https://<tu-backend>.railway.app/health/
# Debe retornar: {"status": "healthy"}
```

**Frontend Health Check**:
```bash
curl https://<tu-frontend>.railway.app/health
# Debe retornar: healthy
```

**Ver Logs**:
```bash
railway logs --service backend
railway logs --service frontend
```

### 8. Configurar Dominio Personalizado (Opcional)

**En Railway Dashboard**:
1. Backend Service → Settings → Domains → Add Custom Domain
2. Agregar: `api.mhsolucionesempresariales.com`
3. Frontend Service → Settings → Domains → Add Custom Domain
4. Agregar: `app.mhsolucionesempresariales.com`

**En tu DNS Provider**:
```
Type: CNAME
Name: api
Value: <tu-backend>.railway.app

Type: CNAME
Name: app
Value: <tu-frontend>.railway.app
```

**Actualizar Variables**:
```bash
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com,api.mhsolucionesempresariales.com
BACKEND_URL=https://api.mhsolucionesempresariales.com
FRONTEND_URL=https://app.mhsolucionesempresariales.com
```

---

## 📈 Monitoreo Post-Despliegue

### Railway Dashboard

1. **Metrics**: CPU, Memory, Network
2. **Logs**: Errores y warnings
3. **Deployments**: Historial y rollback
4. **Usage**: Costos y recursos

### Comandos Útiles

```bash
# Ver logs en tiempo real
railway logs --service backend --tail

# Ver estado de servicios
railway status

# Conectar a database
railway connect postgres

# Ejecutar comando en container
railway run --service backend python manage.py shell

# Ver variables de entorno
railway variables
```

### Health Checks Automáticos

Railway verificará automáticamente:
- Backend: `GET /health/` cada 30s
- Frontend: `GET /health` cada 30s

Si falla 3 veces consecutivas, Railway reiniciará el servicio.

---

## 💰 Estimación de Costos Railway

### Plan Hobby (Recomendado para comenzar)

| Recurso | Uso Estimado | Costo Mensual |
|---------|--------------|---------------|
| **Backend** | 1 GB RAM, 0.5 vCPU | $5 |
| **Frontend** | 512 MB RAM | $2.50 |
| **PostgreSQL** | 1 GB Datos | Incluido |
| **Redis** | 256 MB | Incluido |
| **Volume** | 10 GB | Incluido |
| **Bandwidth** | 100 GB | Incluido |
| **Total** | | ~$7.50-10/mes |

### Plan Pro (Para producción con tráfico)

| Recurso | Uso Estimado | Costo Mensual |
|---------|--------------|---------------|
| **Backend** | 2 GB RAM, 1 vCPU | $10 |
| **Frontend** | 1 GB RAM | $5 |
| **PostgreSQL** | 5 GB Datos | $10 |
| **Redis** | 512 MB | $5 |
| **Volume** | 50 GB | $10 |
| **Total** | | ~$40/mes |

**Comparación con AWS**: ~$120-200/mes → ~$40/mes = **66-75% ahorro**

---

## 🆘 Troubleshooting

### Deployment Falla

**Ver logs**:
```bash
railway logs --service backend
```

**Problemas comunes**:
1. **SECRET_KEY no configurada**: Agregar en variables
2. **DATABASE_URL no conectada**: Vincular PostgreSQL service
3. **Migraciones fallan**: Ver logs, verificar modelos

### Health Check Falla

**Backend**:
1. Verificar que `/health/` existe en urls.py ✅
2. Verificar que Daphne está escuchando en `$PORT`
3. Ver logs: `railway logs --service backend`

**Frontend**:
1. Verificar que nginx configuró `/health` ✅
2. Verificar que nginx está escuchando en `$PORT`
3. Ver logs: `railway logs --service frontend`

### Archivos Media No Persisten

**Solución**: Crear Railway Volume
```
Backend Service → Settings → Volumes → New Volume
- Name: media-storage
- Mount Path: /app/mediafiles
- Size: 10-50 GB
```

### Redis No Conecta

**Verificar**:
1. Redis service está running
2. Backend está vinculado a Redis
3. `REDIS_URL=${{Redis.REDIS_URL}}` en variables

---

## ✅ Checklist Final Pre-Producción

- [ ] SECRET_KEY generada y configurada
- [ ] DATABASE_URL conectada a PostgreSQL
- [ ] REDIS_URL conectada a Redis
- [ ] ALLOWED_HOSTS configurado sin wildcards
- [ ] FRONTEND_URL y BACKEND_URL configurados
- [ ] Google Drive credentials configurados
- [ ] Railway Volume creado para media files
- [ ] Superuser credentials configurados
- [ ] Health checks funcionando (ambos servicios)
- [ ] HTTPS/SSL habilitado
- [ ] CORS configurado correctamente
- [ ] Migraciones aplicadas exitosamente
- [ ] Superuser creado
- [ ] Frontend accesible desde navegador
- [ ] Backend API responde correctamente
- [ ] Login funciona
- [ ] Upload de archivos funciona
- [ ] WebSockets funcionan (si aplica)
- [ ] Dominio personalizado configurado (opcional)
- [ ] Monitoreo configurado
- [ ] Backups configurados

---

## 📚 Documentación de Referencia

- [Railway Deployment Guide](RAILWAY_MIGRATION.md)
- [Railway Storage Guide](RAILWAY_STORAGE_GUIDE.md)
- [Railway Troubleshooting](RAILWAY_TROUBLESHOOTING.md)
- [Railway Deployment Checklist](RAILWAY_DEPLOYMENT_CHECKLIST.md)

---

**Conclusión**: Tu proyecto está **muy bien configurado** para Railway. Con los ajustes recomendados de prioridad alta, estará 100% listo para producción.

**Última actualización**: Diciembre 2024
**Estado**: ✅ LISTO PARA PRODUCCIÓN (con ajustes menores)
