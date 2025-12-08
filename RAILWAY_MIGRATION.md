# 🚂 Guía de Migración de AWS a Railway

Esta guía detalla los pasos necesarios para migrar MH Soluciones Empresariales de AWS a Railway.

## 📋 Índice

1. [Preparación](#preparación)
2. [Configuración de Railway](#configuración-de-railway)
3. [Variables de Entorno](#variables-de-entorno)
4. [Migración de Base de Datos](#migración-de-base-de-datos)
5. [Despliegue](#despliegue)
6. [Configuración de Dominio Personalizado](#configuración-de-dominio-personalizado)
7. [Post-Migración](#post-migración)

---

## Preparación

### Requisitos Previos

- Cuenta en [Railway](https://railway.app)
- Railway CLI instalado: `npm install -g @railway/cli`
- Acceso a la base de datos actual de AWS RDS
- Acceso a las credenciales de Google Drive

### Archivos de Configuración

Los siguientes archivos han sido creados para la migración:

- `railway.json` - Configuración raíz de Railway
- `backend/railway.json` - Configuración específica del backend
- `backend/Dockerfile` - Dockerfile para el backend
- `backend/entrypoint.sh` - Script de entrada para el backend
- `backend/config/settings/railway.py` - Configuración de Django para Railway
- `frontend/railway.json` - Configuración específica del frontend
- `frontend/Dockerfile` - Dockerfile para el frontend
- `frontend/nginx.railway.conf` - Configuración de Nginx para el frontend

---

## Configuración de Railway

### 1. Crear Proyecto en Railway

```bash
# Iniciar sesión en Railway
railway login

# Crear nuevo proyecto
railway init
```

### 2. Añadir Servicios

En el dashboard de Railway, añade los siguientes servicios:

#### PostgreSQL
```bash
# Añadir PostgreSQL desde el dashboard o:
railway add --plugin postgresql
```

#### Redis
```bash
# Añadir Redis desde el dashboard o:
railway add --plugin redis
```

---

## Variables de Entorno

Configura las siguientes variables en Railway Dashboard → Variables:

### Variables Requeridas

| Variable | Descripción | Valor Railway |
|----------|-------------|---------------|
| `SECRET_KEY` | Django secret key | `[Genera una clave segura con python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"]` |
| `DATABASE_URL` | URL de PostgreSQL | `${{Postgres.DATABASE_URL}}` (auto-generada) |
| `REDIS_URL` | URL de Redis | `${{Redis.REDIS_URL}}` (auto-generada) |
| `DJANGO_SETTINGS_MODULE` | Módulo de settings | `config.settings.railway` |

### Variables de Aplicación

| Variable | Descripción | Valor |
|----------|-------------|-------|
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID de carpeta Google Drive | `[Tu ID de carpeta de Google Drive]` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `[Tu Google Client ID]` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | `[Tu Google Client Secret]` |
| `BACKEND_URL` | URL del backend | `https://[tu-proyecto].railway.app` o dominio personalizado |
| `FRONTEND_URL` | URL del frontend | `https://[tu-proyecto].railway.app` o dominio personalizado |
| `ALLOWED_HOSTS` | Hosts permitidos | `*.railway.app,app.mhsolucionesempresariales.com,localhost,127.0.0.1` |

### Variables de Superusuario

| Variable | Valor |
|----------|-------|
| `DJANGO_SUPERUSER_EMAIL` | `[Tu email de superusuario]` |
| `DJANGO_SUPERUSER_PASSWORD` | `[Tu contraseña segura]` |
| `DJANGO_SUPERUSER_USERNAME` | `[Tu nombre de usuario]` |

---

## Migración de Base de Datos

### Opción 1: Exportar/Importar con pg_dump

#### En la máquina local o servidor con acceso a ambas bases de datos:

```bash
# 1. Exportar datos de AWS RDS
pg_dump -h [AWS_RDS_HOST] \
        -U [AWS_RDS_USER] \
        -d [AWS_RDS_DATABASE] \
        -F c \
        -f backup.dump

# 2. Obtener credenciales de Railway
railway variables

# 3. Importar a Railway PostgreSQL
# La URL tendrá el formato: postgresql://user:pass@host:port/database
pg_restore -h [RAILWAY_HOST] \
           -U [RAILWAY_USER] \
           -d [RAILWAY_DATABASE] \
           -p [RAILWAY_PORT] \
           backup.dump
```

### Opción 2: Migración en vivo con pgloader

```bash
# Instalar pgloader
apt-get install pgloader

# Crear archivo de migración
cat > migrate.load << EOF
LOAD DATABASE
     FROM postgresql://[AWS_USER]:[AWS_PASSWORD]@[AWS_RDS_HOST]:5432/[AWS_DATABASE]
     INTO postgresql://[RAILWAY_USER]:[RAILWAY_PASSWORD]@[RAILWAY_HOST]:[RAILWAY_PORT]/[RAILWAY_DATABASE]

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# Ejecutar migración
pgloader migrate.load
```

### Opción 3: Usar Railway CLI

```bash
# Conectar a la base de datos de Railway
railway connect postgres

# Ejecutar comandos SQL directamente
```

---

## Despliegue

### 1. Configurar railway.json

Los archivos `railway.json` están configurados para cada servicio en la estructura monorepo:

**Backend** (`backend/railway.json`):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile",
    "dockerContext": "backend",
    "watchPatterns": ["backend/**"]
  },
  "deploy": {
    "startCommand": "/app/entrypoint.sh",
    "healthcheckPath": "/health/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

**Frontend** (`frontend/railway.json`):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "frontend/Dockerfile",
    "dockerContext": "frontend",
    "watchPatterns": ["frontend/**"]
  },
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

### 2. Desplegar Backend

```bash
# Desde el directorio del proyecto
railway up

# O vincular con GitHub para deploys automáticos
railway link
```

### 3. Desplegar Frontend

Para el frontend, crea un servicio separado en Railway:

```bash
# En el directorio frontend
cd frontend
railway init
railway up
```

O configura un monorepo con dos servicios.

---

## Configuración de Dominio Personalizado

### 1. En Railway Dashboard

1. Ve a tu proyecto → Settings → Domains
2. Click en "Add Custom Domain"
3. Ingresa: `app.mhsolucionesempresariales.com`

### 2. Configurar DNS

En tu proveedor de DNS, añade los siguientes registros:

```
# Para el backend
Type: CNAME
Name: api (o app)
Value: [tu-proyecto].railway.app

# Para el frontend (si es servicio separado)
Type: CNAME
Name: app
Value: [tu-frontend].railway.app
```

### 3. SSL/TLS

Railway proporciona certificados SSL automáticamente. No se requiere configuración adicional.

---

## Post-Migración

### Verificaciones

- [ ] Verificar que la aplicación responde en el nuevo dominio
- [ ] Probar login y autenticación
- [ ] Verificar conexión a base de datos
- [ ] Probar integración con Google Drive
- [ ] Verificar funcionamiento de WebSockets
- [ ] Probar notificaciones en tiempo real
- [ ] Verificar que las tareas de Celery funcionan

### Monitoreo

Railway proporciona logs y métricas integradas:

```bash
# Ver logs en tiempo real
railway logs

# Ver estado del servicio
railway status
```

### Rollback

Si necesitas revertir:

1. En Railway Dashboard, ve a Deployments
2. Selecciona un deployment anterior
3. Click en "Rollback"

### Solución de Problemas

#### Error: "Dockerfile does not exist"

Si encuentras este error en Railway, verifica:

1. **Configuración de monorepo**: Asegúrate de que cada servicio tenga su propio `railway.json` con:
   - `dockerfilePath`: Ruta al Dockerfile desde la raíz del repositorio
   - `dockerContext`: Directorio de contexto de compilación
   - `watchPatterns`: Patrones de archivos a vigilar

2. **Ejemplo de configuración correcta**:
   ```json
   {
     "build": {
       "builder": "DOCKERFILE",
       "dockerfilePath": "backend/Dockerfile",
       "dockerContext": "backend",
       "watchPatterns": ["backend/**"]
     }
   }
   ```

3. **Verifica que los Dockerfiles existan**:
   ```bash
   ls -la backend/Dockerfile
   ls -la frontend/Dockerfile
   ```

---

## Comparación de Costos

| Servicio | AWS (Estimado) | Railway |
|----------|----------------|---------|
| EC2/ECS | $50-100/mes | Incluido en plan |
| RDS PostgreSQL | $30-50/mes | Incluido |
| ElastiCache Redis | $20-30/mes | Incluido |
| Load Balancer | $20/mes | Incluido |
| **Total** | ~$120-200/mes | ~$20-50/mes |

---

## Soporte

- [Documentación de Railway](https://docs.railway.app)
- [Discord de Railway](https://discord.gg/railway)
- [Status de Railway](https://railway.status.io)

---

## Archivos Modificados

- `railway.json` - Configuración raíz de Railway
- `backend/railway.json` - Configuración del servicio backend con rutas correctas para monorepo
- `backend/Dockerfile` - Dockerfile del backend
- `backend/entrypoint.sh` - Script de entrada del backend
- `backend/config/settings/railway.py` - Settings de Django para Railway
- `frontend/railway.json` - Configuración del servicio frontend con rutas correctas para monorepo
- `frontend/Dockerfile` - Dockerfile del frontend
- `frontend/nginx.railway.conf` - Configuración de Nginx para el frontend
- `RAILWAY_MIGRATION.md` - Esta guía

### Notas Importantes

En una configuración de monorepo con Railway, es crucial:
- Especificar `dockerfilePath` relativo a la raíz del repositorio (ej: `backend/Dockerfile`)
- Definir `dockerContext` para establecer el contexto de compilación (ej: `backend`)
- Usar `watchPatterns` para que cada servicio se reconstruya solo cuando cambien sus archivos
