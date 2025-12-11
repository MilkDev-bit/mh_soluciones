# Railway Deployment Guide

This guide provides instructions for deploying the MH Soluciones application on Railway.

## Architecture Overview

The application consists of two services:
- **Backend**: Django REST API (Python)
- **Frontend**: React SPA served by Nginx

Both services must be deployed in the same Railway project to enable private networking.

## Prerequisites

1. A Railway account ([railway.app](https://railway.app))
2. Railway CLI installed (optional, for local testing)
3. GitHub repository connected to Railway

## Deployment Steps

### 1. Create a New Railway Project

1. Log in to Railway
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose the `mh_soluciones` repository

### 2. Deploy Backend Service

1. Click "Add Service" → "GitHub Repo"
2. Select the repository
3. Railway will auto-detect the backend service
4. Configure the following environment variables:

   ```
   # Backend Environment Variables
   PORT=8080
   DJANGO_SECRET_KEY=<your-secret-key>
   DJANGO_DEBUG=False
   DJANGO_ALLOWED_HOSTS=*.railway.app
   DATABASE_URL=<your-database-url>
   # Add other backend-specific variables
   ```

5. The backend will use `backend/railway.json` for configuration
6. Wait for the deployment to complete
7. Note the backend's **public domain** (e.g., `backend-production-xxxx.up.railway.app`)

### 3. Deploy Frontend Service

1. In the same project, click "Add Service" → "GitHub Repo"
2. Select the repository again
3. Railway will auto-detect the frontend service
4. Configure the following environment variables:

   ```
   # Frontend Environment Variables (Automatic)
   PORT=8080
   VITE_API_URL_BASE=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
   BACKEND_URL=${{Backend.RAILWAY_PRIVATE_DOMAIN}}:8080
   ```

   **Note**: The `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` and `${{Backend.RAILWAY_PRIVATE_DOMAIN}}` are Railway template variables that automatically reference the backend service.

5. The frontend will use `frontend/railway.json` for configuration
6. Wait for the deployment to complete

### 4. Verify Private Networking

Railway's private networking should be automatically enabled when services are in the same project. Verify:

1. Both services show "Running" status
2. Frontend service can resolve `${{Backend.RAILWAY_PRIVATE_DOMAIN}}`
3. Check frontend logs for successful DNS resolution

## Environment Variables Reference

### Frontend Service

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Port nginx listens on | `8080` | Yes (auto-set) |
| `VITE_API_URL_BASE` | Public backend API URL for browser | `https://backend.railway.app/api/v1` | Yes |
| `BACKEND_URL` | Private backend URL for nginx proxy | `backend.railway.internal:8080` | No (has fallback) |
| `BACKEND_SERVICE_NAME` | Alternative: backend service name | `backend` | No |

**Fallback behavior**: If neither `BACKEND_URL` nor `BACKEND_SERVICE_NAME` is set, defaults to `backend.railway.internal:8080`.

### Backend Service

Refer to the backend documentation for required environment variables.

## Private Networking Details

Railway provides two types of service URLs:

### Public Domain (RAILWAY_PUBLIC_DOMAIN)
- Format: `service-name-production-xxxx.up.railway.app`
- Accessible from the internet
- Used by browsers to make API calls
- Set in `VITE_API_URL_BASE`

### Private Domain (RAILWAY_PRIVATE_DOMAIN)
- Format: `service-name.railway.internal`
- Only accessible within the Railway project
- Used by nginx to proxy `/api/*` and `/media/*` requests
- Set in `BACKEND_URL`

## How the Proxy Works

1. Browser loads frontend from `https://frontend.railway.app`
2. Frontend JavaScript makes API call to `/api/v1/auth/login` (relative URL)
3. Nginx receives the request and proxies to `http://backend.railway.internal:8080/api/v1/auth/login`
4. Backend processes request and responds
5. Nginx forwards response to browser

**Benefits**:
- Backend URL not exposed in frontend JavaScript
- No CORS issues (same origin)
- Centralized authentication/security headers

## Troubleshooting

### Error: "upstream timed out" or "Connection refused"

**Symptoms**: 
- Nginx logs show `connect() failed (111: Connection refused)`
- Login fails with 502 Bad Gateway

**Solutions**:

1. **Verify both services are running**:
   - Check Railway dashboard
   - Both services should show "Running" status

2. **Check private networking**:
   - Ensure both services are in the same Railway project
   - Check frontend logs for DNS resolution messages
   - Look for "✅ DNS resolution successful" in logs

3. **Verify environment variables**:
   ```bash
   # In Railway frontend service logs, look for:
   🔍 Environment Detection:
      - BACKEND_URL: backend.railway.internal:8080
   ```

4. **Check backend health**:
   - Visit `https://<backend-domain>/health/`
   - Should return 200 OK
   - If not, backend service is not ready

5. **Restart frontend service**:
   - After backend is running, restart frontend
   - Frontend performs health checks on startup

### Error: "Could not extract BACKEND_ORIGIN from VITE_API_URL_BASE"

**Cause**: `VITE_API_URL_BASE` is not set or malformed.

**Solution**: Set the correct format:
```
VITE_API_URL_BASE=https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1
```

### Error: DNS resolution failed

**Symptoms**:
- Frontend logs show "⚠️ WARNING: DNS resolution failed"
- nginx cannot resolve backend hostname

**Solutions**:

1. **Check service name**:
   - In Railway dashboard, verify backend service name
   - Set `BACKEND_SERVICE_NAME` to exact service name
   - Or set full `BACKEND_URL` with `.railway.internal` domain

2. **Wait for DNS propagation**:
   - Railway DNS may take 30-60 seconds to propagate
   - The entrypoint script retries DNS resolution automatically
   - Check logs for retry attempts

3. **Manual configuration**:
   ```bash
   # Option 1: Set service name
   BACKEND_SERVICE_NAME=backend
   
   # Option 2: Set full URL
   BACKEND_URL=backend.railway.internal:8080
   
   # Option 3: Use Railway variable reference
   BACKEND_URL=${{Backend.RAILWAY_PRIVATE_DOMAIN}}:8080
   ```

### Backend returns 400 Bad Request

**Cause**: Django `ALLOWED_HOSTS` doesn't include frontend domain.

**Solution**: Update backend environment:
```bash
DJANGO_ALLOWED_HOSTS=*.railway.app,frontend.railway.app,backend.railway.app
```

### High latency or timeouts on API calls

**Symptoms**: API calls take > 60 seconds, nginx timeout errors

**Solution**: Already implemented in the latest `docker-entrypoint.sh`:
- Proxy timeouts increased to 90 seconds
- DNS resolver configured with 30s cache
- Retry logic for connectivity issues

Check Railway region - ensure both services in same region for lowest latency.

## Health Checks

### Frontend Health Check
- Endpoint: `GET /health`
- Returns: `200 OK` with body `"healthy"`
- Railway polls this endpoint every 60 seconds

### Backend Health Check
- Endpoint: `GET /health/`
- Returns: `200 OK` with backend status
- Frontend verifies this on startup

## Logs and Debugging

### View Frontend Logs
```bash
# In Railway dashboard
Frontend Service → Logs

# Look for these key messages:
✅ DNS resolution successful for backend.railway.internal
✅ Backend is reachable at http://backend.railway.internal:8080/health/
✅ Nginx configured successfully
🚀 Starting nginx on port 8080
```

### View Backend Logs
```bash
# In Railway dashboard
Backend Service → Logs

# Look for:
INFO ... Listening on TCP address 0.0.0.0:8080
```

### Enable Verbose Nginx Logging

Nginx error logs are in `/var/log/nginx/error.log` inside the container.

Railway captures stdout/stderr, so logs appear in the Railway dashboard.

## Rolling Updates

Railway supports zero-downtime deployments:

1. Railway builds new container
2. Starts new container
3. Waits for health check to pass
4. Routes traffic to new container
5. Terminates old container

If health checks fail, Railway keeps the old container running.

## Cost Optimization

1. **Use Starter Plan**: $5/month per service
2. **Sleep Services**: Enable sleep for staging environments
3. **Resource Limits**: Set appropriate memory/CPU limits
4. **Optimize Build**: Use multi-stage Docker builds (already implemented)

## Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **HTTPS Only**: Railway provides free SSL certificates
3. **ALLOWED_HOSTS**: Restrict to Railway domains
4. **Security Headers**: Already configured in nginx
5. **CORS**: Not needed (same-origin via nginx proxy)

## Advanced Configuration

### Custom Backend Service Name

If your backend service is not named "backend":

```bash
# Set environment variable in frontend service
BACKEND_SERVICE_NAME=my-custom-backend-name
```

### Custom Port

If backend runs on a different port:

```bash
# Frontend service environment
BACKEND_URL=backend.railway.internal:3000
```

### Multiple Environments

Create separate Railway projects for different environments:
- `mh-soluciones-production`
- `mh-soluciones-staging`
- `mh-soluciones-development`

Each project has its own environment variables and database.

## Support

For Railway-specific issues:
- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)

For application issues:
- Check GitHub Issues
- Review application logs in Railway dashboard
