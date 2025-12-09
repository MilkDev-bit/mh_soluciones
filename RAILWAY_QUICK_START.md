# 🚀 Railway Quick Start - MH Soluciones

## ⚡ Deploy en 10 Pasos (90 minutos)

### 1️⃣ Generar SECRET_KEY (local)
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```
⚠️ Guardar el resultado - lo necesitarás en Railway

---

### 2️⃣ Crear Cuenta Railway
- Ir a https://railway.app
- "Start a New Project"
- Conectar GitHub account

---

### 3️⃣ Crear Servicios en Railway

**PostgreSQL:**
- Click "+ New" → "Database" → "PostgreSQL"
- Railway genera automáticamente `DATABASE_URL`

**Redis:**
- Click "+ New" → "Database" → "Redis"  
- Railway genera automáticamente `REDIS_URL`

---

### 4️⃣ Crear Backend Service

- Click "+ New" → "GitHub Repo" → `mh_soluciones`
- Railway detectará `backend/railway.json`
- Service name: `backend`

**Vincular Base de Datos:**
- Backend service → Settings → Connect
- Seleccionar PostgreSQL service
- Seleccionar Redis service

---

### 5️⃣ Configurar Variables Backend

Backend → Variables → New Variable:

```bash
# Core
SECRET_KEY=<tu-secret-key-del-paso-1>
DJANGO_SETTINGS_MODULE=config.settings.railway

# Database (auto)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# URLs (actualizar después)
FRONTEND_URL=https://frontend-production-xxxx.up.railway.app
BACKEND_URL=https://backend-production-xxxx.up.railway.app
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com

# Google Drive
GOOGLE_DRIVE_ROOT_FOLDER_ID=<tu-folder-id>
GOOGLE_CLIENT_ID=<tu-client-id>
GOOGLE_CLIENT_SECRET=<tu-client-secret>

# Superuser
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=<contraseña-segura>
```

---

### 6️⃣ Crear Railway Volume

Backend → Settings → Volumes → New Volume:
- **Name:** `media-storage`
- **Mount Path:** `/app/mediafiles`
- **Size:** `10 GB`

---

### 7️⃣ Crear Frontend Service

- Click "+ New" → "GitHub Repo" → `mh_soluciones`
- Railway detectará `frontend/railway.json`
- Service name: `frontend`

**No necesita variables de entorno adicionales**

---

### 8️⃣ Primer Deploy

Railway iniciará automáticamente el build.

**Ver logs:**
```bash
railway logs --service backend
railway logs --service frontend
```

**Esperar:**
- Backend: ~5-10 min (migraciones + build)
- Frontend: ~3-5 min (build)

---

### 9️⃣ Verificar Deployment

**Backend Health:**
```bash
curl https://backend-production-xxxx.up.railway.app/health/
# Debe retornar: {"status":"healthy"}
```

**Frontend Health:**
```bash
curl https://frontend-production-xxxx.up.railway.app/health
# Debe retornar: healthy
```

**Admin Panel:**
```
https://backend-production-xxxx.up.railway.app/admin/
```

**Frontend App:**
```
https://frontend-production-xxxx.up.railway.app/
```

---

### 🔟 Actualizar URLs (Opcional pero recomendado)

**Copiar URLs de Railway:**
- Backend service → Settings → Domains → Copy URL
- Frontend service → Settings → Domains → Copy URL

**Actualizar variables Backend:**
```bash
FRONTEND_URL=https://<tu-frontend-real>.railway.app
BACKEND_URL=https://<tu-backend-real>.railway.app
```

Railway redesplegará automáticamente.

---

## ✅ Checklist Post-Deploy

- [ ] Backend health check funciona
- [ ] Frontend health check funciona
- [ ] Admin panel accesible
- [ ] Login funciona
- [ ] Cambiar password del superuser
- [ ] Probar upload de archivos
- [ ] Verificar Railway Volume funciona

---

## 🆘 Troubleshooting Rápido

**Health check falla:**
```bash
railway logs --service backend
# Buscar errores en el output
```

**Migraciones fallan:**
```bash
# Verificar DATABASE_URL está configurada
railway variables --service backend
```

**Frontend no carga:**
```bash
# Verificar que nginx inició correctamente
railway logs --service frontend
```

---

## 📊 Monitoreo

**Railway Dashboard:**
- Metrics → CPU, RAM, Network
- Logs → Errores y warnings
- Deployments → Historial

**Comandos útiles:**
```bash
# Ver todas las variables
railway variables

# Conectar a database
railway connect postgres

# Ejecutar comando Django
railway run --service backend python manage.py shell
```

---

## 💰 Costos Estimados

| Plan | Costo Mensual |
|------|---------------|
| **Trial** | $5 (crédito único) |
| **Developer** | $5/mes + uso |
| **Hobby** | Solo uso (~$10-15) |
| **Pro** | $20/mes + uso (~$35-40 total) |

**Recomendación inicial:** Developer o Hobby

---

## 🌐 Dominio Personalizado (Opcional)

**En Railway:**
1. Backend → Settings → Domains → Add Custom Domain
   - Domain: `api.mhsolucionesempresariales.com`
2. Frontend → Settings → Domains → Add Custom Domain
   - Domain: `app.mhsolucionesempresariales.com`

**En DNS Provider:**
```
Type: CNAME
Name: api
Value: backend-production-xxxx.up.railway.app

Type: CNAME
Name: app
Value: frontend-production-xxxx.up.railway.app
```

**Actualizar variables:**
```bash
BACKEND_URL=https://api.mhsolucionesempresariales.com
FRONTEND_URL=https://app.mhsolucionesempresariales.com
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com,api.mhsolucionesempresariales.com
```

---

## 📚 Documentación Completa

Para detalles completos, ver:
- **RESUMEN_REVISION_COMPLETA.md** - Resumen ejecutivo completo
- **RAILWAY_STORAGE_GUIDE.md** - Guía de almacenamiento
- **PRODUCTION_READINESS_RAILWAY.md** - Checklist de producción
- **RAILWAY_COST_OPTIMIZATION.md** - Optimización de costos
- **env.railway.template** - Variables de entorno

---

## 🎯 Próximos Pasos Después del Deploy

1. **Seguridad:**
   - [ ] Cambiar password del superuser
   - [ ] Configurar email backend
   - [ ] Revisar permisos de usuarios

2. **Monitoreo:**
   - [ ] Configurar Sentry (recomendado)
   - [ ] Configurar alertas de uptime
   - [ ] Revisar métricas semanalmente

3. **Optimización:**
   - [ ] Monitorear costos
   - [ ] Revisar logs de errores
   - [ ] Optimizar queries lentas

---

**¡Éxito con tu deployment! 🚀**

Si encuentras problemas, revisa RAILWAY_TROUBLESHOOTING.md
