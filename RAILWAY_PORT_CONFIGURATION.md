# Railway Port Configuration Guide

## Overview

This document explains how Railway's dynamic port assignment works with this application and how the configuration ensures proper routing.

## Problem Statement

Railway assigns ports dynamically to services, and the application must:
1. **Listen on the PORT provided by Railway** (not a fixed port)
2. **Bind to all network interfaces** (0.0.0.0) to accept connections from Railway's proxy
3. **Configure health checks** correctly for Railway to monitor service health

## Architecture

```
┌─────────────────────────────────────────────────┐
│           Railway Infrastructure                │
│                                                  │
│  ┌──────────────┐         ┌──────────────┐     │
│  │   Frontend   │         │   Backend    │     │
│  │   Service    │         │   Service    │     │
│  │              │         │              │     │
│  │ Nginx:$PORT  │◄────────┤ Daphne:$PORT │     │
│  │              │  API    │              │     │
│  └──────────────┘         └──────────────┘     │
│         ▲                         ▲             │
│         │                         │             │
│  Railway Proxy                Railway Proxy     │
│  (Port Mapping)              (Port Mapping)     │
└─────────┼─────────────────────────┼─────────────┘
          │                         │
     HTTPS (443)               HTTPS (443)
          │                         │
     User Browser              User Browser
```

## Configuration Files

### 1. Frontend Service

**File: `frontend/railway.json`**
```json
{
  "deploy": {
    "startCommand": "/docker-entrypoint.sh",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

**File: `frontend/docker-entrypoint.sh`**
- Reads `PORT` environment variable (provided by Railway)
- Defaults to port 80 if PORT is not set (for local development)
- Configures nginx to listen on both IPv4 and IPv6
- Binds to `0.0.0.0:$PORT` to accept external connections

**File: `frontend/Dockerfile`**
- Exposes port 80 (documentation only, Railway ignores this)
- Uses ENTRYPOINT to execute docker-entrypoint.sh

### 2. Backend Service

**File: `backend/railway.json`**
```json
{
  "deploy": {
    "startCommand": "/app/entrypoint.sh",
    "healthcheckPath": "/health/",
    "healthcheckTimeout": 300
  }
}
```

**File: `backend/entrypoint.sh`**
- Reads `PORT` environment variable (provided by Railway)
- Defaults to port 8000 if PORT is not set (for local development)
- Starts Daphne ASGI server bound to `0.0.0.0:$PORT`

**File: `backend/Dockerfile`**
- Exposes port 8000 (documentation only, Railway ignores this)
- Uses ENTRYPOINT to execute entrypoint.sh

## How It Works

### Railway Deployment Flow

1. **Railway assigns a PORT** to each service (e.g., 8080 for backend, 80 for frontend)
2. **Container starts** and entrypoint script reads the PORT environment variable
3. **Service binds** to 0.0.0.0:$PORT to listen on all interfaces
4. **Railway proxy** routes external HTTPS (443) → internal $PORT
5. **Health checks** verify the service is responding on $PORT at the configured path

### Port Assignment

Railway automatically sets the `PORT` environment variable:
- **Frontend**: Usually PORT=80 (but can vary)
- **Backend**: Usually PORT=8080 or similar (Railway decides)

### Key Requirements

✅ **DO:**
- Use the PORT environment variable provided by Railway
- Bind to 0.0.0.0 (all interfaces) to accept Railway proxy connections
- Configure health check endpoints that respond on the assigned PORT
- Use startCommand in railway.json to ensure correct entrypoint

❌ **DON'T:**
- Hardcode ports in application configuration
- Bind to 127.0.0.1 or localhost (Railway proxy can't reach it)
- Rely on EXPOSE directive in Dockerfile (Railway ignores it)
- Use internal Docker HEALTHCHECK (conflicts with Railway's health checks)

## Health Checks

### Frontend
- **Endpoint**: `GET /health`
- **Response**: `200 OK` with body "healthy"
- **Implementation**: nginx location block

### Backend
- **Endpoint**: `GET /health/`
- **Response**: `200 OK` with Django health check response
- **Implementation**: Django view

### Why External Health Checks?

Railway uses **external health checks** by making HTTP requests to the service:
- More reliable than internal Docker HEALTHCHECK
- Works with Railway's load balancer
- Verifies the service is accessible from Railway's proxy
- Supports configurable timeout and retry policy

## Troubleshooting

### 502 Bad Gateway

**Symptom**: Frontend or backend returns 502 Bad Gateway

**Common Causes**:
1. ❌ Service not listening on Railway's assigned PORT
2. ❌ Service bound to 127.0.0.1 instead of 0.0.0.0
3. ❌ Health check endpoint not responding
4. ❌ Service crashed or failed to start

**Solution**:
1. Check Railway logs for PORT assignment
2. Verify entrypoint scripts are using PORT correctly
3. Ensure service binds to 0.0.0.0
4. Test health check endpoint

### Health Check Failures

**Symptom**: Railway reports unhealthy service

**Common Causes**:
1. ❌ Wrong health check path
2. ❌ Health check timeout too short
3. ❌ Service not fully initialized

**Solution**:
1. Verify healthcheckPath matches actual endpoint
2. Increase healthcheckTimeout if needed (currently 300s)
3. Add initialization wait time in entrypoint

### Service Not Starting

**Symptom**: Service fails to start or crashes immediately

**Common Causes**:
1. ❌ Missing environment variables
2. ❌ Database connection failure
3. ❌ Syntax errors in entrypoint script

**Solution**:
1. Check Railway environment variables
2. Verify database service is linked and running
3. Test entrypoint script locally with `sh -n script.sh`

## Environment Variables

### Required by Railway
- `PORT` - Automatically set by Railway (DO NOT configure manually)
- `RAILWAY_ENVIRONMENT` - Set by Railway (e.g., "production")
- `RAILWAY_SERVICE_NAME` - Set by Railway (e.g., "frontend", "backend")

### Required by Application
- `SECRET_KEY` - Django secret key
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `FRONTEND_URL` - Frontend public URL
- `BACKEND_URL` - Backend public URL
- `ALLOWED_HOSTS` - Django allowed hosts

See `env.railway.template` for complete list.

## Testing Locally

### Frontend
```bash
cd frontend
PORT=3000 ./docker-entrypoint.sh
# nginx should listen on 0.0.0.0:3000
```

### Backend
```bash
cd backend
PORT=8080 ./entrypoint.sh
# Daphne should listen on 0.0.0.0:8080
```

## References

- [Railway Port Documentation](https://docs.railway.app/deploy/deployments#port-variable)
- [Railway Health Checks](https://docs.railway.app/deploy/healthchecks)
- [nginx Listen Directive](http://nginx.org/en/docs/http/ngx_http_core_module.html#listen)
- [Daphne ASGI Server](https://github.com/django/daphne)
