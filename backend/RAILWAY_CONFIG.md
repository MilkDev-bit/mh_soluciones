# Backend Service - Railway Configuration

## Service Configuration

This `railway.json` file configures the **Backend service** for Railway deployment.

### Important: Separate Service Required

⚠️ **This backend service MUST be deployed as a SEPARATE Railway service from the frontend.**

Each service (frontend and backend) must be its own Railway service to avoid port conflicts.

## Configuration Details

### Build Configuration

- **Builder**: `DOCKERFILE`
- **Dockerfile Path**: `backend/Dockerfile`
- **Build Context**: `backend/`
- **Watch Patterns**: `backend/**` (triggers rebuild on backend changes only)

### Deployment Configuration

- **Start Command**: `/app/entrypoint.sh`
  - Reads `PORT` environment variable (assigned by Railway)
  - Defaults to port 8000 if PORT not set (local dev)
  - Starts Daphne ASGI server on `0.0.0.0:$PORT`

- **Health Check**: 
  - Path: `/health/` (note the trailing slash)
  - Timeout: 300 seconds
  - Railway pings this endpoint to verify service health

- **Restart Policy**:
  - Type: `ON_FAILURE`
  - Max Retries: 3

## Port Configuration

⚠️ **CRITICAL: DO NOT SET PORT MANUALLY**

- Railway automatically assigns a unique `PORT` to this service
- The entrypoint script (`entrypoint.sh`) reads `$PORT` from environment
- Daphne binds to `0.0.0.0:$PORT` to accept Railway proxy connections
- Default fallback is port 8000 (used for local development only)

**Why this matters:**
- If PORT is manually set, both frontend and backend may get the same port
- This causes port conflicts and 502 Bad Gateway errors
- Railway's automatic port assignment prevents conflicts

## Environment Variables

See `/env.railway.template` for required environment variables.

### Required Variables

Must be set in Railway Dashboard → Service → Variables:

```bash
# Core Django
SECRET_KEY=your-secret-key
DJANGO_SETTINGS_MODULE=config.settings.railway
DEBUG=False

# Database (link PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Cache (link Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# URLs
BACKEND_URL=https://your-backend.railway.app
FRONTEND_URL=https://your-frontend.railway.app
ALLOWED_HOSTS=*.railway.app,*.up.railway.app

# Admin User
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@mhsoluciones.com
DJANGO_SUPERUSER_PASSWORD=strong-password-here
```

### DO NOT SET These Variables

❌ Railway sets these automatically:
- `PORT` - Assigned by Railway per service
- `RAILWAY_ENVIRONMENT` - Set by Railway
- `RAILWAY_PROJECT_ID` - Set by Railway
- `RAILWAY_SERVICE_ID` - Set by Railway

## Deployment Flow

1. **Build Phase**:
   - Railway reads `backend/railway.json`
   - Executes `backend/Dockerfile`
   - Builds Python dependencies
   - Collects static files

2. **Deploy Phase**:
   - Railway assigns unique `PORT` to backend service
   - Starts container with `/app/entrypoint.sh`
   - Entrypoint script:
     - Checks environment variables
     - Waits for database to be ready
     - Runs migrations
     - Creates superuser if not exists
     - Starts Daphne on `0.0.0.0:$PORT`

3. **Health Check**:
   - Railway pings `https://backend-url/health/` every few seconds
   - If health check fails 3 times, service is restarted
   - Health check timeout: 300 seconds

## Troubleshooting

### Service shows PORT=8080 (same as frontend)

**Problem**: Port conflict - both services using same port

**Solution**: 
1. Check Railway dashboard - ensure backend is a **separate service**
2. Check Variables tab - remove any manual `PORT` variable
3. Redeploy both services

### 502 Bad Gateway

**Possible causes**:
1. Service not binding to `0.0.0.0` → Check entrypoint.sh
2. Service not using Railway's `$PORT` → Check logs for port assignment
3. Health check failing → Test `https://backend-url/health/`
4. Service crashed → Check build/deploy logs

### Health Check Timeout

**Solution**: 
- Increase `healthcheckTimeout` in railway.json
- Verify `/health/` endpoint responds quickly
- Check database connection (slow queries can delay health check)

## Related Files

- **Dockerfile**: `/backend/Dockerfile`
- **Entrypoint**: `/backend/entrypoint.sh`
- **Settings**: `/backend/config/settings/railway.py`
- **Environment Template**: `/env.railway.template`

## Additional Documentation

- [Railway Service Setup Guide](../RAILWAY_SERVICE_SETUP.md)
- [Railway Port Configuration](../RAILWAY_PORT_CONFIGURATION.md)
- [Deployment Instructions](../RAILWAY_DEPLOYMENT_INSTRUCTIONS.md)

---

**Last Updated**: 2024-12-10
**Service Type**: Backend (Django + Daphne ASGI)
