# MH Soluciones - Sistema de Gestión Empresarial

Sistema completo de gestión empresarial con calendario, tareas, documentos y CRM.

## 🚀 Despliegue en Railway

### ⚠️ IMPORTANTE: Configuración de Puertos

Este proyecto requiere **DOS servicios separados** en Railway para evitar conflictos de puertos:

1. **Frontend Service** - Aplicación React
2. **Backend Service** - API Django

**Problema común:** Si ambos servicios muestran el mismo puerto (ej: PORT=8080), hay un conflicto de configuración.

**Solución rápida:** Ver [`SOLUCION_CONFLICTO_PUERTOS.md`](./SOLUCION_CONFLICTO_PUERTOS.md)

### 📚 Documentación de Railway

- 🚨 **[Solución Conflicto de Puertos](./SOLUCION_CONFLICTO_PUERTOS.md)** - Guía rápida en español
- 📋 **[Deployment Checklist](./RAILWAY_DEPLOYMENT_CHECKLIST.md)** - Lista de verificación completa
- 🔧 **[Service Setup Guide](./RAILWAY_SERVICE_SETUP.md)** - Configuración detallada de servicios
- 📖 **[Port Configuration](./RAILWAY_PORT_CONFIGURATION.md)** - Documentación técnica de puertos
- 🎯 **[Deployment Instructions](./RAILWAY_DEPLOYMENT_INSTRUCTIONS.md)** - Instrucciones de despliegue

### Configuración por Servicio

- **Frontend:** [`frontend/RAILWAY_CONFIG.md`](./frontend/RAILWAY_CONFIG.md)
- **Backend:** [`backend/RAILWAY_CONFIG.md`](./backend/RAILWAY_CONFIG.md)

### Template de Variables

Ver [`env.railway.template`](./env.railway.template) para todas las variables de entorno requeridas.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│         Railway Infrastructure          │
│                                          │
│  ┌──────────────┐   ┌──────────────┐   │
│  │   Frontend   │   │   Backend    │   │
│  │  (React +    │   │  (Django +   │   │
│  │   nginx)     │◄──┤   Daphne)    │   │
│  │              │   │              │   │
│  │  PORT: 80*   │   │  PORT: 8000* │   │
│  └──────────────┘   └──────────────┘   │
│         │                   │           │
│         │                   │           │
│  ┌──────────────┐   ┌──────────────┐   │
│  │  PostgreSQL  │   │    Redis     │   │
│  └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────┘

* Puertos asignados automáticamente por Railway
```

## 🔐 Reglas Críticas de Configuración

### ❌ NO hacer:

1. **NO configurar `PORT` manualmente** en Railway
   - Railway asigna puertos automáticamente
   - Configuración manual causa conflictos

2. **NO desplegar ambos servicios como uno solo**
   - Deben ser DOS servicios separados en Railway

3. **NO usar 127.0.0.1** en código
   - Usar `0.0.0.0` para bind address

### ✅ SÍ hacer:

1. **Crear DOS servicios separados** en Railway
   - Un servicio para Frontend
   - Un servicio para Backend

2. **Dejar que Railway asigne PORT** automáticamente
   - No configurar PORT en variables de entorno

3. **Usar variable `$PORT`** en código
   - Frontend: `PORT="${PORT:-80}"`
   - Backend: `PORT=${PORT:-8000}`

## 🚦 Inicio Rápido

### 1. Crear Servicios en Railway

```bash
# Railway detecta automáticamente los servicios desde:
# - frontend/railway.json → Servicio Frontend
# - backend/railway.json → Servicio Backend
```

### 2. Configurar Variables de Entorno

**Frontend:**
```bash
VITE_API_URL=https://tu-backend.railway.app
```

**Backend:**
```bash
# Ver env.railway.template para lista completa
SECRET_KEY=tu-secret-key
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
# ... otras variables
```

### 3. Verificar Despliegue

```bash
# Health checks
curl https://tu-frontend.railway.app/health
curl https://tu-backend.railway.app/health/

# Logs deben mostrar puertos DIFERENTES:
# Frontend: PORT=80
# Backend: PORT=8000
```

## 📁 Estructura del Proyecto

```
mh_soluciones/
├── frontend/              # Aplicación React + Vite
│   ├── src/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh
│   ├── railway.json      # Config de servicio frontend
│   └── RAILWAY_CONFIG.md
├── backend/               # API Django
│   ├── apps/
│   ├── config/
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── railway.json      # Config de servicio backend
│   └── RAILWAY_CONFIG.md
├── railway.json           # Config raíz (opcional)
├── env.railway.template   # Template de variables
└── SOLUCION_CONFLICTO_PUERTOS.md
```

## 🛠️ Desarrollo Local

### Frontend

```bash
cd frontend
npm install
npm run dev
# Corre en http://localhost:5173
```

### Backend

```bash
cd backend
pip install -r requirements/base.txt
python manage.py migrate
python manage.py runserver
# Corre en http://localhost:8000
```

### Docker Local

```bash
# Frontend
cd frontend
docker build -t mh-frontend .
docker run -p 8080:80 mh-frontend

# Backend
cd backend  
docker build -t mh-backend .
docker run -p 8000:8000 \
  -e SECRET_KEY=test \
  -e DATABASE_URL=postgresql://... \
  mh-backend
```

## 🔍 Troubleshooting

### Error: Mismo puerto en ambos servicios

Ver: [`SOLUCION_CONFLICTO_PUERTOS.md`](./SOLUCION_CONFLICTO_PUERTOS.md)

### Error: 502 Bad Gateway

1. Verificar health checks funcionan
2. Revisar logs de servicios
3. Verificar variables de entorno
4. Ver: [`RAILWAY_DEPLOYMENT_CHECKLIST.md`](./RAILWAY_DEPLOYMENT_CHECKLIST.md)

### Error: Frontend no puede llamar Backend

1. Verificar `VITE_API_URL` en frontend
2. Verificar `ALLOWED_HOSTS` en backend
3. Verificar CORS configurado correctamente
4. Probar health check de backend

## 📊 Características

- 📅 **Calendario** - Gestión de eventos y citas
- ✅ **Tareas** - Sistema de tareas con asignación
- 📄 **Documentos** - Gestión de documentos con Google Drive
- 👥 **CRM** - Gestión de clientes y contactos
- 🔐 **Autenticación** - Login seguro con JWT
- 📧 **Notificaciones** - Email automático para eventos
- 🔄 **Real-time** - WebSockets con Django Channels

## 🔒 Seguridad

- ✅ HTTPS automático en Railway
- ✅ CORS configurado correctamente
- ✅ Security headers (X-Frame-Options, etc.)
- ✅ Secrets en variables de entorno (no en código)
- ✅ Health checks para monitoreo

## 📝 Licencia

Este proyecto es privado y propietario de MH Soluciones.

## 🤝 Soporte

Para problemas de despliegue:
1. Revisar documentación en `/docs`
2. Verificar checklist de despliegue
3. Consultar logs de Railway
4. Revisar Railway Discord

---

**Última Actualización**: 2024-12-10  
**Versión**: 2.0  
**Estado**: Producción en Railway
