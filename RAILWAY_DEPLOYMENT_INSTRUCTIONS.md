# Railway 502 Error Fix - Deployment Instructions

## Summary

This update fixes the 502 Bad Gateway error on Railway by ensuring proper port configuration and network binding for both frontend and backend services.

## Changes Applied

### 1. Frontend Service (`frontend/`)
- ✅ **IPv6 Support**: Added `listen [::]:$PORT;` to nginx configuration
- ✅ **Explicit Start Command**: Added `startCommand: "/docker-entrypoint.sh"` in railway.json
- ✅ **Debug Logging**: Added environment variable logging for troubleshooting
- ✅ **Enhanced Documentation**: Updated Dockerfile with detailed PORT handling comments

### 2. Backend Service (`backend/`)
- ✅ **Explicit Start Command**: Added `startCommand: "/app/entrypoint.sh"` in railway.json
- ✅ **Debug Logging**: Added environment variable logging for troubleshooting
- ✅ **Enhanced Documentation**: Updated Dockerfile with detailed PORT handling comments

### 3. Root Configuration
- ✅ **Schema Addition**: Added Railway schema to railway.json
- ✅ **Restart Policy**: Added restart policy configuration

### 4. Documentation
- ✅ **Comprehensive Guide**: Created `RAILWAY_PORT_CONFIGURATION.md`

## Deployment Steps

### Option 1: Automatic Deployment (Recommended)

If your Railway services are configured for automatic deployment:

1. **Merge this PR** to your main/production branch
2. **Railway will automatically detect** the changes and redeploy both services
3. **Monitor the deployment** in Railway dashboard:
   - Check build logs for the new debug output
   - Verify health checks pass
   - Test frontend and backend endpoints

### Option 2: Manual Deployment

If automatic deployment is not enabled:

1. **Navigate to Railway Dashboard**: https://railway.app/
2. **Select your project**: "mh_soluciones"
3. **Deploy Frontend Service**:
   - Click on "mhsoluciones-production" service
   - Go to "Deployments" tab
   - Click "Deploy" to trigger a new deployment
4. **Deploy Backend Service**:
   - Click on "backend-production" service
   - Go to "Deployments" tab
   - Click "Deploy" to trigger a new deployment

## Verification Steps

After deployment, verify the fixes work:

### 1. Check Service Logs

**Frontend Logs** should show:
```
🚀 Starting Frontend...
🔍 Environment Detection:
   - PORT: 80 (or Railway-assigned port)
   - RAILWAY_ENVIRONMENT: production
   - RAILWAY_SERVICE_NAME: frontend
📍 Configuring nginx to listen on port 80
📍 nginx will bind to 0.0.0.0:80 and [::]:80
✅ Nginx configured successfully
🚀 Starting nginx on port 80...
```

**Backend Logs** should show:
```
📊 Puerto configurado: 8080 (or Railway-assigned port)
📍 Daphne will bind to 0.0.0.0:8080
🔍 Environment:
   - RAILWAY_ENVIRONMENT: production
   - RAILWAY_SERVICE_NAME: backend
```

### 2. Test Health Checks

**Frontend**:
```bash
curl https://your-frontend.railway.app/health
# Should return: healthy
```

**Backend**:
```bash
curl https://your-backend.railway.app/health/
# Should return: 200 OK with health check response
```

### 3. Test Application

1. **Open Frontend URL** in browser
2. **Login to the application**
3. **Verify API calls work** (check browser console for errors)
4. **Test key features** (calendar, tasks, etc.)

## Troubleshooting

### Still Getting 502 Error?

1. **Check Railway Service Status**:
   - Go to Railway Dashboard
   - Verify both services show "Healthy" status
   - Check if health checks are passing

2. **Review Build Logs**:
   - Look for any errors during Docker build
   - Verify entrypoint scripts are executing
   - Check for port assignment in logs

3. **Verify Environment Variables**:
   - Ensure all required variables are set (see `env.railway.template`)
   - Check DATABASE_URL is correct
   - Verify FRONTEND_URL and BACKEND_URL are set

4. **Check Network Configuration**:
   - Ensure services are linked correctly in Railway
   - Verify CORS settings allow frontend to call backend

### Health Checks Failing?

1. **Check Health Check Path**:
   - Frontend: `/health` (no trailing slash)
   - Backend: `/health/` (with trailing slash)

2. **Increase Timeout** (if needed):
   - Edit railway.json
   - Change `healthcheckTimeout` from 300 to a higher value
   - Redeploy

3. **Test Locally**:
   ```bash
   # Frontend
   cd frontend
   docker build -t frontend-test .
   docker run -p 8080:80 frontend-test
   curl http://localhost:8080/health
   
   # Backend (requires env vars)
   cd backend
   docker build -t backend-test .
   docker run -p 8000:8000 -e SECRET_KEY=test -e DATABASE_URL=... backend-test
   curl http://localhost:8000/health/
   ```

### Services Not Starting?

1. **Check for Missing Environment Variables**:
   - Review `env.railway.template`
   - Ensure all required variables are set in Railway

2. **Database Connection Issues**:
   - Verify PostgreSQL service is running
   - Check DATABASE_URL is correct
   - Ensure database migrations ran successfully

3. **Check Build Logs**:
   - Look for npm/pip install errors
   - Verify Dockerfile commands completed
   - Check for permission issues

## Rolling Back

If issues persist, you can roll back:

1. **Go to Railway Dashboard**
2. **Select the service**
3. **Click "Deployments" tab**
4. **Find the previous working deployment**
5. **Click "Redeploy"**

## Additional Resources

- **Railway Port Configuration Guide**: See `RAILWAY_PORT_CONFIGURATION.md`
- **Environment Variables Template**: See `env.railway.template`
- **Railway Documentation**: https://docs.railway.app/
- **Railway Port Docs**: https://docs.railway.app/deploy/deployments#port-variable

## Support

If you continue experiencing issues:

1. **Check Railway Status**: https://status.railway.app/
2. **Review Railway Discord**: https://discord.gg/railway
3. **Check Service Logs** in Railway Dashboard
4. **Review GitHub Issues** for similar problems

## Next Steps

After verifying the fix works:

1. ✅ Monitor service health for 24-48 hours
2. ✅ Update any internal documentation
3. ✅ Consider setting up monitoring/alerting
4. ✅ Document any custom domain setup if applicable
5. ✅ Review and optimize resource allocation in Railway

---

**Last Updated**: 2025-12-10
**Version**: 1.0
**Author**: GitHub Copilot
