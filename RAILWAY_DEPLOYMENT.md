# Railway Deployment Configuration

This document describes the Railway deployment configuration for the MH Soluciones application.

## Architecture

The application consists of three main services deployed on Railway:

1. **PostgreSQL Database** - Managed PostgreSQL database
2. **Redis** - Managed Redis instance for caching and real-time features
3. **Backend** - Django/Daphne application server
4. **Frontend** - React SPA served with nginx

## Service Configuration

### Backend Service

**Service Name**: `Backend`

**Configuration** (`backend/railway.json`):
- Builder: Dockerfile
- Dockerfile Path: `backend/Dockerfile`
- Docker Context: `backend/`
- Start Command: `/app/entrypoint.sh`
- Health Check: `/health/`
- Port: 8080

**Environment Variables**:
- `PORT`: 8080 (set in railway.json)
- `FRONTEND_URL`: `https://${{mh_soluciones.RAILWAY_PUBLIC_DOMAIN}}` (for CORS)
- Database and Redis variables set via Railway UI

**Domain**: `backend-production-21f4.up.railway.app` (example)

### Frontend Service

**Service Name**: `mh_soluciones`

**Configuration** (`frontend/railway.json`):
- Builder: Dockerfile
- Dockerfile Path: `frontend/Dockerfile`
- Docker Context: `frontend/`
- Start Command: `/docker-entrypoint.sh`
- Health Check: `/health`
- Port: 8080

**Environment Variables**:
- `PORT`: 8080 (set in railway.json)
- `VITE_API_URL_BASE`: `https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1` (for API calls)

**Build-time Variables**:
- `VITE_API_URL_BASE`: Passed as ARG during Docker build, baked into the JavaScript bundle

**Domain**: TBD (set via Railway UI)

## How It Works

### Frontend-Backend Communication

1. During frontend build, Railway resolves `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` to the backend's public domain
2. The Dockerfile accepts `VITE_API_URL_BASE` as a build argument
3. Vite bakes this URL into the JavaScript bundle during `npm run build`
4. The frontend's API client (`src/services/api.js`) uses this URL for all API calls
5. CORS is configured on the backend to allow requests from the frontend domain

### CORS Configuration

The backend (`config/settings/railway.py`) automatically allows:
- The configured `FRONTEND_URL` environment variable
- The backend's own Railway domain
- Additional configured origins (e.g., custom domains)

## Deployment Steps

1. Push changes to the repository
2. Railway automatically detects changes and triggers builds
3. Backend service builds and deploys first
4. Frontend service builds (receiving backend URL) and deploys
5. Services are automatically linked via environment variable references

## Troubleshooting

### Frontend shows "Bad Request" or API errors

**Symptom**: Frontend loads but API calls fail

**Causes**:
1. `VITE_API_URL_BASE` not set correctly in frontend railway.json
2. Backend service name reference is incorrect (should match service name in Railway)
3. CORS not configured on backend

**Solutions**:
1. Verify `VITE_API_URL_BASE` in frontend railway.json matches backend service name
2. Check Railway logs for both services
3. Verify backend CORS configuration includes frontend URL

### "nginx: [emerg] bind() to 0.0.0.0:8080 failed"

**Symptom**: Frontend container fails to start

**Cause**: Port conflict or PORT environment variable not set

**Solution**: Verify PORT=8080 is set in railway.json

### Backend health check fails

**Symptom**: Backend service shows unhealthy

**Cause**: Django not responding on /health/ endpoint

**Solution**: Check backend logs for errors in database connection or migrations

## Service References

Railway allows services to reference each other using the syntax:
- `${{ServiceName.VARIABLE_NAME}}`
- `${{ServiceName.RAILWAY_PUBLIC_DOMAIN}}` - The public HTTPS domain of a service

Examples:
- `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` → `backend-production-21f4.up.railway.app`
- `${{Redis.RAILWAY_PRIVATE_DOMAIN}}` → Internal Redis connection string

## Important Notes

1. **Build-time vs Runtime**: `VITE_` environment variables are build-time only and are baked into the frontend bundle
2. **Service Names**: Service names in Railway must match the references in railway.json files
3. **CORS**: Always ensure backend CORS configuration includes the frontend domain
4. **HTTPS**: Railway automatically provides HTTPS for all public domains
