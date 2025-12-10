# ⚠️ SOLUCIÓN: Conflicto de Puertos en Railway

## Resumen del Problema

Railway está asignando el **MISMO puerto (8080) a ambos servicios** (Frontend y Backend), causando:
- ❌ Conflicto de puertos
- ❌ Error 502 Bad Gateway
- ❌ Servicios no pueden iniciar correctamente

## Causa Raíz

Una de estas tres causas:
1. **Solo un servicio desplegado** en lugar de dos servicios separados
2. **Variable PORT configurada manualmente** en Railway (sobrescribe la asignación automática)
3. **Servicios no separados correctamente** en el dashboard de Railway

## Solución Paso a Paso

### 1. Verificar Servicios en Railway Dashboard

Ir a: https://railway.app/project/[tu-project-id]

**Debes ver DOS servicios separados:**
- ✅ `mhsoluciones-frontend` (o nombre similar)
- ✅ `mhsoluciones-backend` (o nombre similar)

**Si solo ves UN servicio:**
- ❌ Problema: Ambos frontend y backend en un solo servicio
- ✅ Solución: Crear dos servicios separados (ver paso 2)

### 2. Crear Dos Servicios Separados

#### Opción A: Railway detecta automáticamente

Railway debería detectar automáticamente los dos servicios basándose en:
- `/frontend/railway.json` → Servicio Frontend
- `/backend/railway.json` → Servicio Backend

Si no los detecta, procede con Opción B.

#### Opción B: Crear manualmente

**Servicio Frontend:**
1. Click **"+ New"** en Railway dashboard
2. Seleccionar **"GitHub Repo"**
3. Repositorio: `MilkDev-bit/mh_soluciones`
4. Root Directory: `/` (dejarlo vacío)
5. Service Name: `mhsoluciones-frontend`

**Servicio Backend:**
1. Click **"+ New"** en Railway dashboard
2. Seleccionar **"GitHub Repo"**
3. Repositorio: `MilkDev-bit/mh_soluciones`
4. Root Directory: `/` (dejarlo vacío)
5. Service Name: `mhsoluciones-backend`

### 3. Verificar Variables de Entorno

Para **CADA SERVICIO** (Frontend y Backend), ir a:
**Dashboard → Service → Variables**

#### ⚠️ CRÍTICO: NO configurar PORT manualmente

**Verificar que NO exista la variable `PORT`:**

```bash
# ❌ ELIMINAR si existe:
PORT=8080  # Esto causa el conflicto!
PORT=80
PORT=8000

# ✅ NO debe existir la variable PORT
# Railway la asigna automáticamente
```

**Si encuentras `PORT` configurada manualmente:**
1. Click en los 3 puntos (⋮) al lado de la variable
2. Click **"Remove"**
3. Confirmar eliminación
4. Hacer esto en AMBOS servicios

### 4. Configurar Variables Requeridas

#### Servicio Frontend

```bash
# API URL del backend (actualizar después de desplegar backend)
VITE_API_URL=https://tu-backend.railway.app
```

#### Servicio Backend

Ver archivo `/env.railway.template` para lista completa.

**Variables mínimas requeridas:**
```bash
SECRET_KEY=tu-secret-key-aqui
DJANGO_SETTINGS_MODULE=config.settings.railway
DEBUG=False
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
BACKEND_URL=https://tu-backend.railway.app
FRONTEND_URL=https://tu-frontend.railway.app
ALLOWED_HOSTS=*.railway.app,*.up.railway.app
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=tu-password-seguro
```

### 5. Re-desplegar Servicios

Después de hacer los cambios:

1. **Frontend**: Click en **"Deploy"** o esperar auto-deploy
2. **Backend**: Click en **"Deploy"** o esperar auto-deploy

### 6. Verificar Logs

#### Frontend debe mostrar:
```
🚀 Starting Frontend...
🔍 Environment Detection:
   - PORT: 80          ← Puerto asignado por Railway
   - RAILWAY_ENVIRONMENT: production
📍 Configuring nginx to listen on port 80
✅ Nginx configured successfully
```

#### Backend debe mostrar:
```
🚀 Iniciando servidor Daphne en puerto 8000...  ← Puerto DIFERENTE
📍 Daphne will bind to 0.0.0.0:8000
🔍 Environment:
   - RAILWAY_ENVIRONMENT: production
```

### 7. Verificar Puertos Diferentes

✅ **CORRECTO** (cada servicio tiene su propio puerto):
```
Frontend: PORT=80    ← Asignado por Railway
Backend:  PORT=8000  ← Asignado por Railway
```

❌ **INCORRECTO** (mismo puerto = conflicto):
```
Frontend: PORT=8080  ← Mismo puerto!
Backend:  PORT=8080  ← Mismo puerto!
```

## Verificación Final

### 1. Health Checks

```bash
# Frontend
curl https://tu-frontend.railway.app/health
# Debe devolver: "healthy"

# Backend
curl https://tu-backend.railway.app/health/
# Debe devolver: 200 OK con respuesta JSON
```

### 2. Probar Aplicación

1. Abrir frontend en navegador
2. Intentar login
3. Verificar que no hay errores 502
4. Verificar que las llamadas API funcionan

## Archivos de Documentación

- **Guía completa**: [`RAILWAY_SERVICE_SETUP.md`](./RAILWAY_SERVICE_SETUP.md)
- **Configuración de puertos**: [`RAILWAY_PORT_CONFIGURATION.md`](./RAILWAY_PORT_CONFIGURATION.md)
- **Template de variables**: [`env.railway.template`](./env.railway.template)
- **Config Frontend**: [`frontend/RAILWAY_CONFIG.md`](./frontend/RAILWAY_CONFIG.md)
- **Config Backend**: [`backend/RAILWAY_CONFIG.md`](./backend/RAILWAY_CONFIG.md)

## Preguntas Frecuentes

### ¿Por qué no puedo configurar PORT manualmente?

Railway asigna puertos dinámicamente a cada servicio. Si configuras PORT manualmente:
- Ambos servicios obtienen el mismo puerto
- Se genera un conflicto de puertos
- Uno de los servicios no puede iniciar

Railway necesita controlar PORT para:
- Asignar puertos únicos a cada servicio
- Enrutar tráfico externo correctamente
- Evitar conflictos entre servicios

### ¿Qué puerto debería usar cada servicio?

**No importa** - Railway asigna automáticamente:
- Frontend: Típicamente 80 o similar
- Backend: Típicamente 8000 o similar
- **Lo importante**: Cada servicio obtiene un puerto DIFERENTE

Tu código lee `$PORT` del ambiente y se adapta automáticamente.

### ¿Cómo funciona el enrutamiento?

```
Usuario (HTTPS:443) 
    ↓
Railway Proxy
    ↓
Frontend Container (PORT asignado por Railway, ej: 80)
Backend Container (PORT asignado por Railway, ej: 8000)
```

Railway:
1. Asigna puerto único a cada servicio
2. Enruta HTTPS:443 externo → Puerto interno del servicio
3. Tus entrypoint scripts leen $PORT y configuran el servidor
4. Todo funciona sin conflictos

### ¿Y si sigo viendo el error?

1. Verificar que hay **DOS servicios separados** en Railway
2. Verificar que **NO existe** variable `PORT` en ningún servicio
3. Ver logs de ambos servicios - deben mostrar puertos diferentes
4. Verificar health checks funcionan
5. Consultar documentación completa en `RAILWAY_SERVICE_SETUP.md`

## Soporte

Si el problema persiste después de seguir estos pasos:
1. Revisar logs completos de ambos servicios
2. Verificar configuración de servicios en Railway dashboard
3. Consultar [Railway Discord](https://discord.gg/railway)
4. Revisar [Railway Docs](https://docs.railway.app/)

---

**Última Actualización**: 2024-12-10
**Estado**: Solución para conflicto de puertos
**Prioridad**: 🔥 Crítica
