# Railway Service Setup - Port Configuration Guide

## ⚠️ IMPORTANT: Port Conflict Resolution

### The Problem

If both Frontend and Backend services are showing the same PORT in logs (e.g., both on port 8080), this indicates a **Railway configuration issue** where:

1. **Only ONE service is deployed** instead of TWO separate services
2. **PORT is manually set** as an environment variable (which overrides Railway's automatic assignment)
3. **Services are not properly separated** in Railway dashboard

### The Solution

Railway requires **TWO SEPARATE SERVICES** to be created:
1. One service for **Frontend** 
2. One service for **Backend**

Each service will automatically receive its own unique PORT from Railway.

---

## Step-by-Step Setup in Railway

### 1. Create Two Separate Services

#### Option A: From Railway Dashboard

1. Go to your Railway project: https://railway.app/project/[your-project-id]
2. Click **"+ New"** button
3. Create **Service 1: Frontend**
   - Click **"GitHub Repo"**
   - Select repository: `MilkDev-bit/mh_soluciones`
   - **Root Directory**: Leave empty or set to `/`
   - **Service Name**: `mhsoluciones-frontend` (or similar)
   
4. Create **Service 2: Backend**
   - Click **"+ New"** button again
   - Click **"GitHub Repo"**
   - Select repository: `MilkDev-bit/mh_soluciones`
   - **Root Directory**: Leave empty or set to `/`
   - **Service Name**: `mhsoluciones-backend` (or similar)

#### Option B: Using railway.json Detection

Railway will automatically detect multiple services if you have:
- `/frontend/railway.json` → Creates Frontend service
- `/backend/railway.json` → Creates Backend service

Make sure **both services are visible** in your Railway dashboard.

---

### 2. Configure Frontend Service

**Service Settings:**
- **Name**: `mhsoluciones-frontend` (or your preferred name)
- **Root Directory**: `/` (Railway will use `frontend/railway.json` automatically)

**Environment Variables** (Railway Dashboard → Service → Variables):

```bash
# ✅ DO NOT SET PORT - Railway assigns this automatically
# ❌ Remove any manual PORT configuration

# Required Variables:
VITE_API_URL=https://your-backend-url.railway.app
# Add other frontend-specific environment variables here
```

**Important Notes:**
- ✅ Railway will **automatically assign** a PORT (usually 80 or similar)
- ❌ **DO NOT manually set** `PORT` environment variable
- The `frontend/railway.json` configures build and deployment
- The `frontend/docker-entrypoint.sh` reads `$PORT` dynamically

---

### 3. Configure Backend Service

**Service Settings:**
- **Name**: `mhsoluciones-backend` (or your preferred name)
- **Root Directory**: `/` (Railway will use `backend/railway.json` automatically)

**Environment Variables** (Railway Dashboard → Service → Variables):

```bash
# ✅ DO NOT SET PORT - Railway assigns this automatically
# ❌ Remove any manual PORT configuration

# Required Variables (from env.railway.template):
SECRET_KEY=your-secret-key-here
DJANGO_SETTINGS_MODULE=config.settings.railway
DEBUG=False

# Database (link PostgreSQL service):
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (link Redis service):
REDIS_URL=${{Redis.REDIS_URL}}

# URLs:
BACKEND_URL=https://your-backend-url.railway.app
FRONTEND_URL=https://your-frontend-url.railway.app
ALLOWED_HOSTS=*.railway.app,*.up.railway.app

# Superuser:
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=your-strong-password

# Google Drive (optional):
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-folder-id

# Email (optional):
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=noreply@mhsoluciones.com
```

**Important Notes:**
- ✅ Railway will **automatically assign** a PORT (usually 8000 or similar)
- ❌ **DO NOT manually set** `PORT` environment variable
- The `backend/railway.json` configures build and deployment
- The `backend/entrypoint.sh` reads `$PORT` dynamically

---

### 4. Link Database Services

**PostgreSQL:**
1. In Railway dashboard, create a **PostgreSQL** service (or use existing)
2. In **Backend service** → **Variables** → Click **"New Variable"**
3. Select **"Reference"** → Choose PostgreSQL service
4. Use: `DATABASE_URL=${{Postgres.DATABASE_URL}}`

**Redis:**
1. In Railway dashboard, create a **Redis** service (or use existing)
2. In **Backend service** → **Variables** → Click **"New Variable"**
3. Select **"Reference"** → Choose Redis service
4. Use: `REDIS_URL=${{Redis.REDIS_URL}}`

---

## Verification

After setting up both services, verify the configuration:

### 1. Check Service Logs

**Frontend Logs** should show:
```
🚀 Starting Frontend...
🔍 Environment Detection:
   - PORT: 80           ← Automatically assigned by Railway
   - RAILWAY_ENVIRONMENT: production
   - RAILWAY_SERVICE_NAME: frontend
📍 Configuring nginx to listen on port 80
✅ Nginx configured successfully
🚀 Starting nginx on port 80...
```

**Backend Logs** should show:
```
🚀 Iniciando servidor Daphne en puerto 8000...  ← Different port, automatically assigned
📍 Daphne will bind to 0.0.0.0:8000
🔍 Environment:
   - RAILWAY_ENVIRONMENT: production
   - RAILWAY_SERVICE_NAME: backend
```

### 2. Verify Different Ports

✅ **Correct Configuration:**
- Frontend: `PORT=80` (or another port assigned by Railway)
- Backend: `PORT=8000` (or another port assigned by Railway)
- **Different ports for each service**

❌ **Incorrect Configuration (Port Conflict):**
- Frontend: `PORT=8080`
- Backend: `PORT=8080`
- **Same port = CONFLICT**

---

## Troubleshooting Port Conflicts

### Issue: Both services showing the same PORT

**Cause:** Only one service is deployed, or PORT is manually configured

**Solution:**
1. Go to Railway Dashboard
2. Verify **TWO separate services** are listed:
   - `mhsoluciones-frontend`
   - `mhsoluciones-backend`
3. If only one service exists, create the missing service
4. Check **each service's Variables tab**:
   - ❌ Remove any manual `PORT` variable
   - ✅ Let Railway assign PORT automatically

### Issue: Cannot set PORT to specific value

**Understanding:** Railway **dynamically assigns** PORT per service. You cannot (and should not) set it manually.

**Why this works:**
- Railway assigns unique PORT to each service automatically
- Railway's proxy routes external traffic (HTTPS/443) → internal PORT
- Your code reads `$PORT` environment variable to bind correctly
- This allows Railway to manage ports without conflicts

### Issue: 502 Bad Gateway Error

**Common Causes:**
1. ❌ Service not binding to `0.0.0.0` (check entrypoint scripts)
2. ❌ Service not listening on Railway's assigned `$PORT`
3. ❌ Health check endpoint not responding
4. ❌ Service crashed during startup

**Solution:**
1. Check service logs for errors
2. Verify entrypoint scripts use `$PORT` correctly
3. Test health check endpoints:
   - Frontend: `https://your-frontend.railway.app/health`
   - Backend: `https://your-backend.railway.app/health/`

---

## Environment Variable Checklist

Before deploying, verify these variables are set correctly:

### ✅ Variables TO SET (per service):

**Frontend Service:**
- `VITE_API_URL` - Backend URL

**Backend Service:**
- `SECRET_KEY` - Django secret
- `DATABASE_URL` - PostgreSQL reference
- `REDIS_URL` - Redis reference
- `FRONTEND_URL` - Frontend URL
- `BACKEND_URL` - Backend URL
- `ALLOWED_HOSTS` - Comma-separated domains
- `DJANGO_SUPERUSER_*` - Admin credentials
- Email, Google Drive configs (optional)

### ❌ Variables NOT TO SET:

- `PORT` - ⚠️ **NEVER SET MANUALLY** - Railway assigns this
- `RAILWAY_ENVIRONMENT` - Auto-set by Railway
- `RAILWAY_PROJECT_ID` - Auto-set by Railway
- `RAILWAY_SERVICE_ID` - Auto-set by Railway
- `RAILWAY_PUBLIC_DOMAIN` - Auto-set by Railway

---

## Testing After Deployment

### 1. Test Frontend

```bash
# Health check
curl https://your-frontend.railway.app/health
# Expected: "healthy"

# Test application
open https://your-frontend.railway.app
# Should load the application
```

### 2. Test Backend

```bash
# Health check
curl https://your-backend.railway.app/health/
# Expected: 200 OK with JSON response

# Test API
curl https://your-backend.railway.app/api/v1/
# Should return API root or 401/403
```

### 3. Test Frontend-Backend Communication

1. Open frontend URL in browser
2. Open browser DevTools → Network tab
3. Try to login or access a feature
4. Verify API calls go to backend URL
5. Check for CORS errors (should be none)

---

## Common Mistakes to Avoid

❌ **DON'T:**
1. Set `PORT` manually as environment variable
2. Deploy both services as a single Railway service
3. Use hardcoded ports in application code
4. Bind services to `127.0.0.1` (use `0.0.0.0`)

✅ **DO:**
1. Create TWO separate Railway services
2. Let Railway assign PORT automatically
3. Use `$PORT` environment variable in code
4. Bind services to `0.0.0.0:$PORT`
5. Configure health check endpoints
6. Link database services with variable references

---

## Quick Reference

### Frontend Service
- **Service Name**: `mhsoluciones-frontend`
- **Railway.json**: `/frontend/railway.json`
- **Dockerfile**: `/frontend/Dockerfile`
- **Entrypoint**: `/frontend/docker-entrypoint.sh`
- **Health Check**: `GET /health` (no trailing slash)
- **Default PORT**: 80 (assigned by Railway)

### Backend Service
- **Service Name**: `mhsoluciones-backend`
- **Railway.json**: `/backend/railway.json`
- **Dockerfile**: `/backend/Dockerfile`
- **Entrypoint**: `/backend/entrypoint.sh`
- **Health Check**: `GET /health/` (with trailing slash)
- **Default PORT**: 8000 (assigned by Railway)

---

## Additional Resources

- **Railway Documentation**: https://docs.railway.app/
- **Railway Port Variable**: https://docs.railway.app/deploy/deployments#port-variable
- **Railway Health Checks**: https://docs.railway.app/deploy/healthchecks
- **Environment Template**: See `env.railway.template`
- **Port Configuration Guide**: See `RAILWAY_PORT_CONFIGURATION.md`
- **Deployment Instructions**: See `RAILWAY_DEPLOYMENT_INSTRUCTIONS.md`

---

**Last Updated**: 2024-12-10
**Version**: 2.0
**Purpose**: Resolve port conflicts in Railway deployment
