# Railway Deployment Guide

## Overview

This document explains how the MH Soluciones application is configured for Railway deployment and how to troubleshoot common connectivity issues.

## Architecture

The application consists of two services deployed on Railway:
- **Frontend**: Nginx reverse proxy + Vite React application
- **Backend**: Django REST API

### Network Communication

Railway provides two types of networking:
1. **Public Domain** (`*.railway.app`): For external client access
2. **Private Domain** (`*.railway.internal`): For internal service-to-service communication

## Configuration

### Frontend Service (`frontend/railway.json`)

```json
{
  "env": {
    "PORT": "8080",
    "VITE_API_URL_BASE": "https://${{Backend.RAILWAY_PUBLIC_DOMAIN}}/api/v1",
    "BACKEND_URL": "${{Backend.RAILWAY_PRIVATE_DOMAIN}}:8080"
  }
}
```

**Environment Variables:**
- `VITE_API_URL_BASE`: Public URL used by browser to access backend API
- `BACKEND_URL`: Private URL used by nginx to proxy requests to backend

### Backend Service (`backend/railway.json`)

```json
{
  "env": {
    "PORT": "8080"
  }
}
```

**Auto-set by Railway:**
- `RAILWAY_PUBLIC_DOMAIN`: Public domain for external access
- `RAILWAY_PRIVATE_DOMAIN`: Private domain for internal communication

## How It Works

### Request Flow

1. **Browser → Frontend (Public)**
   ```
   https://frontend-production-xxx.railway.app/api/v1/auth/login/
   ```

2. **Frontend Nginx → Backend (Private)**
   ```
   http://backend-production-xxx.railway.internal:8080/api/v1/auth/login/
   ```

3. **Backend Django Response → Frontend → Browser**

### Nginx Configuration

The `frontend/docker-entrypoint.sh` script:
1. Reads `BACKEND_URL` from environment (set by Railway)
2. Generates nginx configuration with dynamic backend URL
3. Uses DNS resolver to handle Railway's dynamic private domains

**Key nginx directives:**
```nginx
location /api/ {
    set $backend_url "http://backend-production-xxx.railway.internal:8080";
    proxy_pass $backend_url/api/;
    proxy_set_header Host $host;
    # ... other headers
}
```

### Django ALLOWED_HOSTS

The backend accepts requests from multiple sources:

```python
ALLOWED_HOSTS = [
    'app.mhsolucionesempresariales.com',  # Production domain
    '.railway.app',                        # Railway public domains
    '.railway.internal',                   # Railway private networking
    'backend.railway.internal',            # Legacy format
    # + RAILWAY_PUBLIC_DOMAIN
    # + RAILWAY_PRIVATE_DOMAIN
]
```

## Troubleshooting

### Issue: 502 Bad Gateway

**Symptoms:**
```
nginx: backend.railway.internal could not be resolved
```

**Cause:** Backend URL not properly configured

**Solution:**
1. Check `BACKEND_URL` environment variable in frontend service
2. Verify it's set to: `${{Backend.RAILWAY_PRIVATE_DOMAIN}}:8080`
3. Confirm both services are in the same Railway project/environment

### Issue: Invalid HTTP_HOST header

**Symptoms:**
```
django.core.exceptions.DisallowedHost: Invalid HTTP_HOST header: 'backend-production-xxx.railway.internal:8080'
```

**Cause:** Railway internal domain not in Django's ALLOWED_HOSTS

**Solution:**
Already fixed in `backend/config/settings/railway.py`:
- Added `.railway.internal` wildcard
- Added `backend.railway.internal` legacy format
- Added dynamic `RAILWAY_PRIVATE_DOMAIN` from environment

### Issue: CORS Errors

**Symptoms:**
```
Access to fetch at 'https://backend.railway.app/api/v1/...' from origin 'https://frontend.railway.app' has been blocked by CORS policy
```

**Cause:** Frontend origin not in backend's CORS_ALLOWED_ORIGINS

**Solution:**
Check `FRONTEND_URL` environment variable in backend service. The backend automatically adds:
- `FRONTEND_URL` from environment
- `https://{RAILWAY_PUBLIC_DOMAIN}` from Railway

## Environment Variables Checklist

### Frontend Service
- ✅ `PORT`: Auto-set by Railway (usually 8080)
- ✅ `VITE_API_URL_BASE`: Set in railway.json
- ✅ `BACKEND_URL`: Set in railway.json

### Backend Service
- ✅ `PORT`: Auto-set by Railway (usually 8080)
- ✅ `RAILWAY_PUBLIC_DOMAIN`: Auto-set by Railway
- ✅ `RAILWAY_PRIVATE_DOMAIN`: Auto-set by Railway
- ⚙️ `FRONTEND_URL` (optional): Set manually if needed
- ⚙️ `ALLOWED_HOSTS` (optional): Additional hosts as comma-separated list

## Monitoring

### Check Nginx Logs (Frontend)
```bash
# View real-time logs in Railway dashboard
# Look for DNS resolution and proxy pass messages
```

**Success indicators:**
```
✅ DNS resolution successful for backend-production-xxx.railway.internal
✅ Backend is reachable at http://backend-production-xxx.railway.internal:8080/health/
```

**Error indicators:**
```
❌ backend-production-xxx.railway.internal could not be resolved
⚠️ WARNING: Backend health check failed or timed out
```

### Check Django Logs (Backend)
```bash
# View real-time logs in Railway dashboard
# Look for ALLOWED_HOSTS errors
```

**Success indicators:**
```
✅ RAILWAY PRODUCTION CONFIGURATION
🌐 Allowed Hosts: ['app.mhsolucionesempresariales.com', '.railway.app', '.railway.internal', ...]
```

**Error indicators:**
```
❌ Invalid HTTP_HOST header: 'backend-production-xxx.railway.internal:8080'
```

## Testing After Deployment

1. **Health Check**
   ```bash
   curl https://backend-production-xxx.railway.app/health/
   # Expected: {"status": "ok"}
   ```

2. **API Request via Frontend**
   ```bash
   curl https://frontend-production-xxx.railway.app/api/v1/health/
   # Should proxy to backend successfully
   ```

3. **Login Test**
   - Navigate to frontend URL
   - Try to log in
   - Check browser Network tab for 200 status codes
   - Check Railway logs for successful API calls

## Common Pitfalls

1. **Hardcoding URLs**: Never hardcode Railway URLs. Always use environment variables.
2. **Missing ALLOWED_HOSTS**: Django will reject requests from unknown hosts.
3. **Wrong Port**: Backend runs on port 8080, not 8000 (Railway's default).
4. **DNS Propagation**: Railway's internal DNS may take a few seconds to propagate.
5. **Service Names**: Use private domains (`*.railway.internal`), not public domains for internal communication.

## Reference Links

- [Railway Private Networking](https://docs.railway.app/guides/private-networking)
- [Django ALLOWED_HOSTS](https://docs.djangoproject.com/en/stable/ref/settings/#allowed-hosts)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)

## Support

If you encounter issues not covered here:
1. Check Railway deployment logs for both services
2. Verify environment variables are set correctly
3. Ensure both services are deployed and running
4. Review this guide's troubleshooting section
5. Check Railway status page for platform issues
