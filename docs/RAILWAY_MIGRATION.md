# Guía de Migración: AWS a Railway

Esta guía detalla el proceso de migración del proyecto MH Soluciones de AWS a Railway.

## Tabla de Contenidos
1. [Variables de Entorno](#variables-de-entorno)
2. [Configuración de Railway](#configuración-de-railway)
3. [Migración de Base de Datos](#migración-de-base-de-datos)
4. [Configuración de Redis](#configuración-de-redis)
5. [Almacenamiento de Archivos](#almacenamiento-de-archivos)
6. [Dominio Personalizado](#dominio-personalizado)
7. [Comandos de Migración](#comandos-de-migración)

## Variables de Entorno

### Variables que MANTIENEN los mismos valores:
```env
SECRET_KEY=<tu_secret_key_actual>
GOOGLE_DRIVE_ROOT_FOLDER_ID=1GzwCmhVge_dvluiNWw4EOlYPG12cGn6
GOOGLE_CLIENT_ID=370441853678-mscatthfirljuolptk36289ncjf1sl78.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<tu_google_client_secret>
DJANGO_SUPERUSER_EMAIL=soporte@mhsolucionesempresariales.com
DJANGO_SUPERUSER_PASSWORD=<tu_password>
DJANGO_SUPERUSER_USERNAME=soporte
```

### Variables que CAMBIAN para Railway:
```env
# Railway PostgreSQL (proporcionada automáticamente al agregar PostgreSQL)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway

# Railway Redis (proporcionada automáticamente al agregar Redis)
REDIS_URL=redis://default:PASSWORD@HOST:PORT

# URLs - Temporal con Railway domain
BACKEND_URL=https://mh-soluciones-backend.up.railway.app
FRONTEND_URL=https://mh-soluciones-frontend.up.railway.app

# O con dominio personalizado configurado:
BACKEND_URL=https://api.mhsolucionesempresariales.com
FRONTEND_URL=https://app.mhsolucionesempresariales.com

# ALLOWED_HOSTS - Añadir Railway domains
ALLOWED_HOSTS=*.railway.app,*.up.railway.app,app.mhsolucionesempresariales.com,localhost,127.0.0.1
```

## Configuración de Railway

### 1. Crear Proyecto en Railway

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear nuevo proyecto
railway init

# Conectar repositorio GitHub
railway link
```

### 2. Agregar Servicios

En el dashboard de Railway:

1. **PostgreSQL**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway generará automáticamente `DATABASE_URL`

2. **Redis**:
   - Click "New" → "Database" → "Add Redis"
   - Railway generará automáticamente `REDIS_URL`

3. **Backend Service**:
   - Click "New" → "GitHub Repo"
   - Seleccionar el repositorio
   - Configurar root directory: `backend`
   - Usar el Dockerfile existente

4. **Frontend Service** (opcional - puede desplegarse en Vercel/Netlify):
   - Click "New" → "GitHub Repo"
   - Configurar root directory: `frontend`
   - Usar el Dockerfile existente

### 3. Configurar Variables de Entorno

En cada servicio, ir a "Variables" y agregar:

**Backend:**
```
SECRET_KEY=<valor>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
DJANGO_SETTINGS_MODULE=config.settings.production
GOOGLE_DRIVE_ROOT_FOLDER_ID=<valor>
GOOGLE_CLIENT_ID=<valor>
GOOGLE_CLIENT_SECRET=<valor>
BACKEND_URL=https://<tu-backend>.up.railway.app
FRONTEND_URL=https://<tu-frontend>.up.railway.app
ALLOWED_HOSTS=*.railway.app,*.up.railway.app,app.mhsolucionesempresariales.com
DJANGO_SUPERUSER_EMAIL=<valor>
DJANGO_SUPERUSER_PASSWORD=<valor>
DJANGO_SUPERUSER_USERNAME=<valor>
```

**Frontend:**
```
VITE_API_BASE_URL=https://<tu-backend>.up.railway.app/api/v1
VITE_WS_BASE_URL=wss://<tu-backend>.up.railway.app/ws
```

## Migración de Base de Datos

### Exportar datos de AWS RDS

```bash
# Conectar a RDS y exportar
pg_dump -h mh-soluciones-empresariales-db.c3ikmg2um5nf.us-east-2.rds.amazonaws.com \
        -U postgres \
        -d mh_soluciones_db \
        -F c \
        -f mh_soluciones_backup.dump

# O exportar como SQL plano
pg_dump -h mh-soluciones-empresariales-db.c3ikmg2um5nf.us-east-2.rds.amazonaws.com \
        -U postgres \
        -d mh_soluciones_db \
        --no-owner \
        --no-acl \
        -f mh_soluciones_backup.sql
```

### Importar a Railway PostgreSQL

```bash
# Obtener credenciales de Railway
railway variables

# O desde el dashboard, copiar DATABASE_URL

# Importar usando pg_restore (para formato custom)
pg_restore -h <railway-host> \
           -U postgres \
           -d railway \
           -p <port> \
           --no-owner \
           --no-acl \
           mh_soluciones_backup.dump

# O usando psql (para formato SQL)
psql $DATABASE_URL < mh_soluciones_backup.sql
```

### Usando Railway CLI

```bash
# Conectar a la base de datos Railway
railway connect postgres

# Dentro de psql, importar datos
\i mh_soluciones_backup.sql
```

## Configuración de Redis

Railway Redis se configura automáticamente. La variable `REDIS_URL` se inyecta al servicio.

### Verificar conexión
```bash
railway connect redis

# Probar conexión
PING
```

## Almacenamiento de Archivos

### Opción 1: Mantener S3 (Recomendado)
Continuar usando AWS S3 para archivos media. Configurar las variables:
```env
AWS_ACCESS_KEY_ID=<tu_access_key>
AWS_SECRET_ACCESS_KEY=<tu_secret_key>
AWS_STORAGE_BUCKET_NAME=mh-soluciones-media
AWS_S3_REGION_NAME=us-east-2
```

### Opción 2: Railway Volume
Railway ofrece volúmenes persistentes, pero con limitaciones:
- Máximo 100GB
- Solo disponible en servicio que lo monta

```bash
# En el dashboard de Railway:
# Service → Settings → Mount Volume
# Path: /app/mediafiles
```

### Opción 3: Cloudflare R2 (Alternativa S3-compatible)
Configurar igual que S3 pero con endpoint de R2:
```env
AWS_S3_ENDPOINT_URL=https://<account_id>.r2.cloudflarestorage.com
AWS_STORAGE_BUCKET_NAME=mh-soluciones-media
```

## Dominio Personalizado

### 1. En Railway Dashboard

1. Ir al servicio (backend o frontend)
2. Settings → Domains
3. Click "Custom Domain"
4. Ingresar dominio: `api.mhsolucionesempresariales.com` (backend) o `app.mhsolucionesempresariales.com` (frontend)

### 2. Configurar DNS

En tu proveedor DNS, agregar registro CNAME:
```
api.mhsolucionesempresariales.com  CNAME  <tu-servicio>.up.railway.app
app.mhsolucionesempresariales.com  CNAME  <tu-servicio>.up.railway.app
```

### 3. Actualizar Variables

Una vez configurado el dominio personalizado:
```env
BACKEND_URL=https://api.mhsolucionesempresariales.com
FRONTEND_URL=https://app.mhsolucionesempresariales.com
ALLOWED_HOSTS=api.mhsolucionesempresariales.com,app.mhsolucionesempresariales.com,*.railway.app
```

## Comandos de Migración

### Script completo de migración

```bash
#!/bin/bash
# migrate-to-railway.sh

set -e

echo "=== Migración MH Soluciones: AWS → Railway ==="

# 1. Instalar Railway CLI
echo "Instalando Railway CLI..."
npm install -g @railway/cli

# 2. Login
echo "Iniciando sesión en Railway..."
railway login

# 3. Crear proyecto
echo "Creando proyecto Railway..."
railway init

# 4. Agregar servicios (esto se hace en el dashboard)
echo "
Por favor, en el dashboard de Railway:
1. Agregar PostgreSQL
2. Agregar Redis
3. Agregar servicio desde GitHub (backend)
4. Agregar servicio desde GitHub (frontend)
5. Configurar variables de entorno

Presiona Enter cuando hayas completado..."
read

# 5. Exportar datos de AWS RDS
echo "Exportando datos de AWS RDS..."
echo "Ingresa la contraseña de PostgreSQL AWS:"
pg_dump -h mh-soluciones-empresariales-db.c3ikmg2um5nf.us-east-2.rds.amazonaws.com \
        -U postgres \
        -d mh_soluciones_db \
        --no-owner \
        --no-acl \
        -f /tmp/mh_soluciones_backup.sql

# 6. Importar a Railway
echo "Importando datos a Railway PostgreSQL..."
railway connect postgres < /tmp/mh_soluciones_backup.sql

# 7. Verificar
echo "Verificando migración..."
railway run python manage.py check

echo "=== Migración completada ==="
echo "
Próximos pasos:
1. Verificar que la aplicación funcione en Railway
2. Configurar dominio personalizado
3. Actualizar DNS
4. Probar todas las funcionalidades
5. Desactivar recursos AWS cuando todo esté verificado
"
```

### Verificación post-migración

```bash
# Verificar estado del servicio
railway status

# Ver logs
railway logs

# Ejecutar comandos Django
railway run python manage.py check
railway run python manage.py migrate --check

# Verificar conexión a base de datos
railway run python manage.py dbshell
```

## Rollback

Si necesitas volver a AWS:

1. Los recursos AWS siguen activos (no eliminar hasta verificar Railway)
2. Cambiar DNS de vuelta a AWS
3. Actualizar variables de entorno en AWS

## Costos Estimados Railway

- **Hobby Plan**: $5/mes por servicio
- **PostgreSQL**: Desde $0 (free tier) hasta $20+/mes
- **Redis**: Desde $0 (free tier) hasta $10+/mes
- **Total estimado**: $15-50/mes (dependiendo del uso)

Comparado con AWS (típicamente $50-200/mes para esta configuración).

## Soporte

- [Documentación Railway](https://docs.railway.app/)
- [Railway Discord](https://discord.gg/railway)
- [Status Page](https://status.railway.app/)
