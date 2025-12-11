# Railway Configuration Guide

## Service Environment Variable References

This project uses Railway's service reference syntax to dynamically connect frontend and backend services.

### How it Works

#### Backend Service (`backend/railway.json`)
- No environment variables configured in railway.json
- All variables (PORT, BACKEND_URL, FRONTEND_URL, etc.) are configured directly in Railway dashboard
- Railway automatically provides `PORT` environment variable
- Healthcheck endpoint: `/health/`

#### Frontend Service (`frontend/railway.json`)
- Only `VITE_API_URL_BASE` is configured (needed for build-time injection)
- References the Backend service: `${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1`
- Railway automatically provides `PORT` environment variable
- Runtime script (`docker-entrypoint.sh`) derives backend domain from `VITE_API_URL_BASE`
- Healthcheck endpoint: `/health`

### Environment Variable Flow

```
Railway Backend Service
  └─> RAILWAY_PUBLIC_DOMAIN (e.g., "backend-production.up.railway.app")
       └─> Referenced in Frontend railway.json as ${{Backend.RAILWAY_PUBLIC_DOMAIN}}
            └─> Sets VITE_API_URL_BASE="https://backend-production.up.railway.app/api/v1"
                 └─> Build-time: Injected into Vite app
                 └─> Runtime: docker-entrypoint.sh extracts backend domain
                      └─> Configures nginx proxy to forward /api/* to backend
```

### Service Reference Syntax

Railway uses the following syntax to reference variables from other services:
```
${{SERVICE_NAME.VARIABLE_NAME}}
```

For built-in Railway variables like `RAILWAY_PUBLIC_DOMAIN`:
```
${{RAILWAY_PUBLIC_DOMAIN}}
```

### Important Notes

1. **Service Names**: Must match exactly the service names configured in Railway (case-sensitive)
   - Backend service: `Backend`
   - Frontend service: `Frontend`

2. **Build-time vs Runtime Variables**:
   - `VITE_API_URL_BASE` is a build-time variable (needed during `npm run build`)
   - Railway automatically passes env variables as build args to Dockerfile
   - The Dockerfile accepts it as `ARG VITE_API_URL_BASE`
   - At runtime, `docker-entrypoint.sh` derives `BACKEND_ORIGIN` from `VITE_API_URL_BASE`

3. **PORT Variable**:
   - Automatically provided by Railway (typically 8080)
   - No need to configure in railway.json
   - Used by both backend and frontend to bind services

4. **Nginx Proxy Configuration**:
   - Frontend nginx acts as reverse proxy to backend
   - Extracts backend domain from `VITE_API_URL_BASE`
   - Forwards `/api/*` requests to `https://backend-domain/api/*`
   - Forwards `/media/*` requests to `https://backend-domain/media/*`
   - Sets Host header to backend domain for proper routing

### Required Environment Variables in Railway Dashboard

#### Backend Service:
- ALLOWED_HOSTS (configured in Railway dashboard)
- BACKEND_URL (configured in Railway dashboard)
- DATABASE_URL
- DEBUG
- DJANGO_SETTINGS_MODULE
- DJANGO_SUPERUSER_EMAIL
- DJANGO_SUPERUSER_PASSWORD
- DJANGO_SUPERUSER_USERNAME
- EMAIL_BACKEND
- EMAIL_HOST
- EMAIL_HOST_PASSWORD
- EMAIL_HOST_USER
- EMAIL_PORT
- EMAIL_USE_TLS
- FRONTEND_URL (configured in Railway dashboard)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_DRIVE_ROOT_FOLDER_ID
- REDIS_URL
- SECRET_KEY
- PORT (automatically provided by Railway)

#### Frontend Service:
- VITE_API_URL_BASE (configured in railway.json via service reference)
- PORT (automatically provided by Railway)

### Troubleshooting

If the frontend cannot connect to the backend:
1. Verify service names in Railway match the references in `railway.json` (Backend, Frontend)
2. Check that both services are deployed and have public domains assigned
3. Verify the build logs show `VITE_API_URL_BASE` is set correctly
4. Check the frontend runtime logs for "Derived BACKEND_ORIGIN from VITE_API_URL_BASE"
5. Verify nginx configuration test passes in frontend logs
6. Check browser console for the actual API URL being used

If healthchecks fail:
1. **Backend**: Check `/health/` endpoint returns 200 with JSON `{"status": "healthy"}`
2. **Frontend**: Check `/health` endpoint returns 200 with text "healthy"
3. Verify ALLOWED_HOSTS in backend includes Railway domain
4. Check nginx error logs in frontend: `/var/log/nginx/error.log`

If you get 502 errors:
1. Check backend is running and accessible
2. Verify nginx proxy configuration has correct backend domain
3. Check Host header is set to backend domain (not frontend domain)
4. Ensure backend ALLOWED_HOSTS includes the backend domain

### Testing Locally

When testing locally without Railway, the frontend falls back to:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';
```

You can set `VITE_API_URL_BASE` in a `.env` file for local development.

For local Docker testing:
```bash
# Frontend
docker build --build-arg VITE_API_URL_BASE=http://localhost:8000/api/v1 -t frontend .
docker run -e PORT=8080 -p 8080:8080 frontend

# Backend
docker build -t backend .
docker run -e PORT=8000 -p 8000:8000 backend
```
