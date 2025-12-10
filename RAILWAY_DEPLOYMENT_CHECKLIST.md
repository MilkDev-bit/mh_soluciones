# Railway Deployment Checklist - Port Configuration

## Pre-Deployment Checklist

Antes de desplegar en Railway, verificar:

### ✅ 1. Estructura de Servicios

- [ ] Verificar que existen **DOS servicios separados** en Railway:
  - Frontend service (detectado por `frontend/railway.json`)
  - Backend service (detectado por `backend/railway.json`)

### ✅ 2. Variables de Entorno - Frontend

Railway Dashboard → Frontend Service → Variables:

- [ ] `VITE_API_URL` configurado con URL del backend
- [ ] ⚠️ **NO existe** variable `PORT` (Railway la asigna automáticamente)
- [ ] ⚠️ **NO existe** variable `RAILWAY_ENVIRONMENT` (auto-set)

### ✅ 3. Variables de Entorno - Backend

Railway Dashboard → Backend Service → Variables:

- [ ] `SECRET_KEY` configurado (único y secreto)
- [ ] `DJANGO_SETTINGS_MODULE=config.settings.railway`
- [ ] `DEBUG=False`
- [ ] `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- [ ] `REDIS_URL=${{Redis.REDIS_URL}}`
- [ ] `BACKEND_URL` configurado con URL del backend
- [ ] `FRONTEND_URL` configurado con URL del frontend
- [ ] `ALLOWED_HOSTS` incluye `*.railway.app,*.up.railway.app`
- [ ] `DJANGO_SUPERUSER_*` variables configuradas
- [ ] ⚠️ **NO existe** variable `PORT` (Railway la asigna automáticamente)

### ✅ 4. Servicios de Base de Datos

- [ ] PostgreSQL service creado en Railway
- [ ] Redis service creado en Railway
- [ ] Backend service **linked** a PostgreSQL
- [ ] Backend service **linked** a Redis

### ✅ 5. Configuración de Archivos

- [ ] `/backend/railway.json` existe y está correcto
- [ ] `/frontend/railway.json` existe y está correcto
- [ ] `/backend/entrypoint.sh` tiene permisos de ejecución
- [ ] `/frontend/docker-entrypoint.sh` tiene permisos de ejecución

## Post-Deployment Verification

Después del despliegue, verificar:

### ✅ 1. Logs de Servicios

**Frontend logs deben mostrar:**
```
🚀 Starting Frontend...
🔍 Environment Detection:
   - PORT: 80 (o el puerto asignado por Railway)
   - RAILWAY_ENVIRONMENT: production
📍 Configuring nginx to listen on port 80
✅ Nginx configured successfully
```

**Backend logs deben mostrar:**
```
🚀 Iniciando servidor Daphne en puerto 8000... (o el puerto asignado)
📍 Daphne will bind to 0.0.0.0:8000
🔍 Environment:
   - RAILWAY_ENVIRONMENT: production
```

### ✅ 2. Puertos Diferentes

- [ ] Frontend y Backend muestran **puertos DIFERENTES** en logs
- [ ] Si ambos muestran el mismo puerto (ej: 8080), hay un problema de configuración

### ✅ 3. Health Checks

```bash
# Frontend
curl https://tu-frontend.railway.app/health
# Debe devolver: "healthy"

# Backend  
curl https://tu-backend.railway.app/health/
# Debe devolver: 200 OK
```

- [ ] Frontend health check responde correctamente
- [ ] Backend health check responde correctamente
- [ ] Ambos servicios muestran estado "Healthy" en Railway dashboard

### ✅ 4. Funcionalidad de la Aplicación

- [ ] Frontend carga correctamente en el navegador
- [ ] Login funciona sin errores
- [ ] No hay errores 502 Bad Gateway
- [ ] API calls del frontend al backend funcionan
- [ ] No hay errores CORS en la consola del navegador

## Troubleshooting Checklist

Si hay problemas:

### ❌ Error: Mismo puerto en ambos servicios

**Síntoma:**
```
Frontend: PORT=8080
Backend:  PORT=8080  ← ¡Mismo puerto!
```

**Solución:**
- [ ] Verificar que hay DOS servicios separados en Railway (no uno solo)
- [ ] Eliminar variable `PORT` manual de ambos servicios
- [ ] Re-desplegar ambos servicios
- [ ] Verificar logs - deben mostrar puertos diferentes

### ❌ Error: 502 Bad Gateway

**Causas posibles:**
- [ ] Servicio no escucha en `0.0.0.0` (revisar entrypoint scripts)
- [ ] Servicio no usa `$PORT` de Railway (revisar logs)
- [ ] Health check no responde (probar curl)
- [ ] Servicio crasheó (revisar deploy logs)

**Solución:**
- [ ] Revisar logs de deploy completos
- [ ] Verificar health check endpoints
- [ ] Comprobar variables de entorno requeridas
- [ ] Verificar database/redis están corriendo

### ❌ Error: Health Check Failing

**Solución:**
- [ ] Verificar path de health check:
  - Frontend: `/health` (sin slash final)
  - Backend: `/health/` (con slash final)
- [ ] Aumentar `healthcheckTimeout` si es necesario
- [ ] Probar health check manualmente con curl
- [ ] Revisar logs de nginx/daphne

### ❌ Error: Build Failing

**Solución:**
- [ ] Verificar Dockerfile paths en railway.json
- [ ] Verificar dockerContext es correcto
- [ ] Revisar build logs para errores específicos
- [ ] Verificar dependencias en package.json / requirements.txt

## Critical Port Configuration Rules

### ⚠️ REGLAS CRÍTICAS - NO IGNORAR

1. **NUNCA configurar PORT manualmente** en Railway variables
   - Railway asigna PORT automáticamente
   - Configuración manual causa conflictos
   
2. **Dos servicios separados son OBLIGATORIOS**
   - Un servicio para Frontend
   - Un servicio para Backend
   - No pueden compartir el mismo servicio

3. **Cada servicio debe usar su railway.json**
   - Frontend usa `/frontend/railway.json`
   - Backend usa `/backend/railway.json`
   - Railway los detecta automáticamente

4. **Entrypoint scripts deben leer $PORT**
   - Frontend: `PORT="${PORT:-80}"`
   - Backend: `PORT=${PORT:-8000}`
   - Default solo para desarrollo local

5. **Servicios deben bind a 0.0.0.0**
   - No usar 127.0.0.1 o localhost
   - Railway proxy requiere 0.0.0.0
   - IPv6 también: `[::]` para nginx

## Quick Reference Commands

### Ver logs en Railway CLI
```bash
# Frontend logs
railway logs --service frontend

# Backend logs
railway logs --service backend
```

### Probar health checks localmente
```bash
# Frontend (Docker)
cd frontend
docker build -t frontend-test .
docker run -p 8080:80 frontend-test
curl http://localhost:8080/health

# Backend (Docker)
cd backend
docker build -t backend-test .
docker run -p 8000:8000 -e SECRET_KEY=test backend-test
curl http://localhost:8000/health/
```

## Documentation References

- **Solución rápida**: [`SOLUCION_CONFLICTO_PUERTOS.md`](./SOLUCION_CONFLICTO_PUERTOS.md)
- **Guía completa**: [`RAILWAY_SERVICE_SETUP.md`](./RAILWAY_SERVICE_SETUP.md)
- **Configuración puertos**: [`RAILWAY_PORT_CONFIGURATION.md`](./RAILWAY_PORT_CONFIGURATION.md)
- **Variables template**: [`env.railway.template`](./env.railway.template)
- **Frontend config**: [`frontend/RAILWAY_CONFIG.md`](./frontend/RAILWAY_CONFIG.md)
- **Backend config**: [`backend/RAILWAY_CONFIG.md`](./backend/RAILWAY_CONFIG.md)

---

**Última Actualización**: 2024-12-10
**Propósito**: Prevenir conflictos de puertos en Railway
**Prioridad**: 🔥 Crítica
