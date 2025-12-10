# Frontend Service - Railway Configuration

## Service Configuration

This `railway.json` file configures the **Frontend service** for Railway deployment.

### Important: Separate Service Required

⚠️ **This frontend service MUST be deployed as a SEPARATE Railway service from the backend.**

Each service (frontend and backend) must be its own Railway service to avoid port conflicts.

## Configuration Details

### Build Configuration

- **Builder**: `DOCKERFILE`
- **Dockerfile Path**: `frontend/Dockerfile`
- **Build Context**: `frontend/`
- **Watch Patterns**: `frontend/**` (triggers rebuild on frontend changes only)

### Deployment Configuration

- **Start Command**: `/docker-entrypoint.sh`
  - Reads `PORT` environment variable (assigned by Railway)
  - Defaults to port 80 if PORT not set (local dev)
  - Configures nginx to listen on `0.0.0.0:$PORT` and `[::]:$PORT`
  - Starts nginx in foreground mode

- **Health Check**: 
  - Path: `/health` (no trailing slash)
  - Timeout: 300 seconds
  - Returns: `200 OK` with body "healthy"

- **Restart Policy**:
  - Type: `ON_FAILURE`
  - Max Retries: 3

## Port Configuration

⚠️ **CRITICAL: DO NOT SET PORT MANUALLY**

- Railway automatically assigns a unique `PORT` to this service
- The entrypoint script (`docker-entrypoint.sh`) reads `$PORT` from environment
- nginx binds to `0.0.0.0:$PORT` and `[::]:$PORT` to accept Railway proxy connections
- Default fallback is port 80 (used for local development only)

**Why this matters:**
- If PORT is manually set, both frontend and backend may get the same port
- This causes port conflicts and 502 Bad Gateway errors
- Railway's automatic port assignment prevents conflicts

## Environment Variables

Frontend requires minimal environment variables.

### Required Variables

Must be set in Railway Dashboard → Service → Variables:

```bash
# Backend API URL (update after backend is deployed)
VITE_API_URL=https://your-backend.railway.app
```

### DO NOT SET These Variables

❌ Railway sets these automatically:
- `PORT` - Assigned by Railway per service
- `RAILWAY_ENVIRONMENT` - Set by Railway
- `RAILWAY_PROJECT_ID` - Set by Railway
- `RAILWAY_SERVICE_ID` - Set by Railway

## Deployment Flow

1. **Build Phase**:
   - Railway reads `frontend/railway.json`
   - Executes `frontend/Dockerfile`
   - Build stage: Installs npm dependencies and builds Vite app
   - Production stage: Copies built files to nginx

2. **Deploy Phase**:
   - Railway assigns unique `PORT` to frontend service
   - Starts container with `/docker-entrypoint.sh`
   - Entrypoint script:
     - Reads `PORT` environment variable
     - Generates nginx config with correct port
     - Starts nginx on `0.0.0.0:$PORT`

3. **Health Check**:
   - Railway pings `https://frontend-url/health` every few seconds
   - nginx returns `200 OK` with "healthy"
   - If health check fails 3 times, service is restarted

## nginx Configuration

The entrypoint script (`docker-entrypoint.sh`) dynamically generates nginx configuration:

### Features

- **Gzip Compression**: Enabled for text/css/js/json files
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, etc.
- **Static Asset Caching**: 1-year cache for JS/CSS/images
- **SPA Routing**: All routes serve `index.html`
- **Health Endpoint**: `/health` returns "healthy"

### Listen Directives

```nginx
listen ${PORT};          # IPv4
listen [::]:${PORT};     # IPv6
```

Both directives ensure nginx accepts connections from Railway's proxy on both IPv4 and IPv6.

## Troubleshooting

### Service shows PORT=8080 (same as backend)

**Problem**: Port conflict - both services using same port

**Solution**: 
1. Check Railway dashboard - ensure frontend is a **separate service**
2. Check Variables tab - remove any manual `PORT` variable
3. Redeploy both services

### 502 Bad Gateway

**Possible causes**:
1. nginx not binding to `0.0.0.0` → Check entrypoint script
2. nginx not using Railway's `$PORT` → Check logs for port assignment
3. Health check failing → Test `https://frontend-url/health`
4. Service crashed → Check build/deploy logs

### Health Check Timeout

**Solution**: 
- Health check should respond instantly (nginx endpoint)
- If timing out, check nginx logs
- Verify nginx is running: `ps aux | grep nginx` in container

### Frontend can't reach Backend API

**Problem**: API calls failing with CORS or network errors

**Solution**:
1. Verify `VITE_API_URL` is set to backend Railway URL
2. Check backend `ALLOWED_HOSTS` includes frontend domain
3. Verify backend `FRONTEND_URL` is set correctly
4. Test backend health check: `curl https://backend-url/health/`

## Build Optimization

The Dockerfile uses multi-stage builds:

### Stage 1: Build
- Uses `node:20-alpine`
- Installs dependencies with `npm ci`
- Builds production bundle with `npm run build`
- Output: `/app/dist/` directory

### Stage 2: Production
- Uses `nginx:alpine` (minimal image)
- Copies only built files from Stage 1
- Removes default nginx config
- Adds custom entrypoint for dynamic port configuration
- Final image is small and optimized

## Related Files

- **Dockerfile**: `/frontend/Dockerfile`
- **Entrypoint**: `/frontend/docker-entrypoint.sh`
- **Vite Config**: `/frontend/vite.config.js`
- **Environment Template**: `/env.railway.template`

## Additional Documentation

- [Railway Service Setup Guide](../RAILWAY_SERVICE_SETUP.md)
- [Railway Port Configuration](../RAILWAY_PORT_CONFIGURATION.md)
- [Deployment Instructions](../RAILWAY_DEPLOYMENT_INSTRUCTIONS.md)

---

**Last Updated**: 2024-12-10
**Service Type**: Frontend (React + Vite + nginx)
