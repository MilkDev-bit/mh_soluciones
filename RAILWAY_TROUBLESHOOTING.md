# Railway Deployment Troubleshooting Guide

## Health Check Failures

If you're experiencing health check failures during Railway deployment, this guide will help you diagnose and fix the issues.

### Common Issues and Solutions

#### 1. Service Not Binding to Railway's PORT

**Symptom:** Health checks fail with "service unavailable" even though the build succeeds.

**Cause:** Railway assigns a dynamic `PORT` environment variable, and your service must listen on that port.

**Solution for Backend:**
- The backend Dockerfile uses shell form CMD to allow PORT variable expansion
- Entrypoint script properly passes `$PORT` to Daphne
- Default fallback to port 8000 if PORT is not set

```dockerfile
CMD sh -c "daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"
```

**Solution for Frontend:**
- Custom entrypoint script (`docker-entrypoint.sh`) dynamically generates nginx config
- Nginx is configured at runtime to listen on the PORT from Railway
- Default fallback to port 80 if PORT is not set

#### 2. Database Connection Issues

**Symptom:** Backend starts but fails when trying to connect to database.

**Required Environment Variables:**
- `DATABASE_URL` - Auto-set by Railway PostgreSQL service
- `REDIS_URL` - Auto-set by Railway Redis service
- `SECRET_KEY` - Must be manually configured

**Check Database Connection:**
```bash
# Connect to Railway database
railway connect postgres

# Or check environment variables
railway variables
```

#### 3. Missing Environment Variables

**Required Variables for Backend:**

```bash
# Core Django settings
SECRET_KEY=your-secret-key-here
DJANGO_SETTINGS_MODULE=config.settings.railway

# Database (auto-configured by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Application URLs
FRONTEND_URL=https://your-frontend.railway.app
BACKEND_URL=https://your-backend.railway.app
ALLOWED_HOSTS=*.railway.app,app.mhsolucionesempresariales.com

# Google Drive Integration
GOOGLE_DRIVE_ROOT_FOLDER_ID=your-folder-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Superuser (for initial setup)
DJANGO_SUPERUSER_USERNAME=admin
DJANGO_SUPERUSER_EMAIL=admin@example.com
DJANGO_SUPERUSER_PASSWORD=secure-password
```

**Required Variables for Frontend:**
- No additional environment variables needed
- PORT is automatically set by Railway

#### 4. Health Check Timeout Too Short

**Symptom:** Health checks fail because migrations take longer than the timeout.

**Solution:** 
- Health check timeout is set to 300 seconds (5 minutes) in `railway.json`
- This allows time for database migrations and superuser creation
- If you need more time, increase `healthcheckTimeout` in `railway.json`

```json
{
  "deploy": {
    "healthcheckPath": "/health/",
    "healthcheckTimeout": 300
  }
}
```

#### 5. Nginx Not Starting (Frontend)

**Symptom:** Frontend build succeeds but nginx fails to start.

**Check:**
1. Verify `docker-entrypoint.sh` has execute permissions (handled in Dockerfile)
2. Verify nginx config is generated correctly
3. Check logs: `railway logs`

**Common Fixes:**
- Ensure PORT variable is being passed correctly
- Check for syntax errors in generated nginx config
- Verify static files are built correctly (`npm run build`)

### Debugging Commands

```bash
# View real-time logs
railway logs

# View logs for specific service
railway logs --service backend

# Check service status
railway status

# View environment variables
railway variables

# Connect to database
railway connect postgres

# SSH into running container (if available)
railway shell
```

### Health Check Endpoints

**Backend:** `https://your-backend.railway.app/health/`
- Returns: `{"status": "healthy"}`
- Defined in: `backend/config/urls.py`

**Frontend:** `https://your-frontend.railway.app/health`
- Returns: `healthy` (plain text)
- Defined in: `frontend/docker-entrypoint.sh` (nginx config)

### Verifying Deployment

After deployment, verify these endpoints:

1. **Backend Health:** `curl https://your-backend.railway.app/health/`
2. **Frontend Health:** `curl https://your-frontend.railway.app/health`
3. **Backend API:** `curl https://your-backend.railway.app/api/v1/`
4. **Frontend App:** Open in browser

### Rolling Back

If a deployment fails:

1. Go to Railway Dashboard → Deployments
2. Select a previous working deployment
3. Click "Rollback"

### Common Error Messages

**"service unavailable"**
- Service not binding to correct PORT
- Service crashed during startup
- Check logs: `railway logs`

**"connection refused"**
- Database not accessible
- Check DATABASE_URL is set correctly
- Verify PostgreSQL service is running

**"Invalid HTTP_HOST header"**
- Add domain to ALLOWED_HOSTS environment variable
- Format: `ALLOWED_HOSTS=*.railway.app,yourdomain.com`

**"Static files not found"**
- Backend: Verify collectstatic ran during build
- Frontend: Verify `npm run build` succeeded
- Check Dockerfile build logs

### Port Configuration

**Backend:**
- Listens on PORT from environment (Railway sets this)
- Defaults to 8000 if PORT not set
- Health check: `/health/` on the same port

**Frontend:**
- Nginx listens on PORT from environment
- Defaults to 80 if PORT not set
- Health check: `/health` on the same port

### Migration Issues

If migrations fail:

1. Check DATABASE_URL is correct
2. Verify database is accessible
3. Check for migration conflicts
4. Run manually: `railway run python manage.py migrate`

### SSL/TLS

Railway automatically provides SSL certificates for:
- `*.railway.app` domains
- Custom domains (after DNS configuration)

No additional configuration needed!

### Support Resources

- [Railway Docs](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [Railway Status](https://railway.status.io)

### Recent Changes (2024-12)

1. **Removed Docker HEALTHCHECK directives**
   - Railway uses external health checks
   - Internal HEALTHCHECK can interfere with dynamic PORT

2. **Added dynamic PORT binding**
   - Backend: Shell form CMD for variable expansion
   - Frontend: Runtime nginx config generation

3. **Reduced health check timeout**
   - From 600s to 300s for faster feedback
   - Still allows time for migrations

4. **Fixed entrypoint scripts**
   - Proper PORT variable handling
   - Better error messages
   - Railway environment detection
