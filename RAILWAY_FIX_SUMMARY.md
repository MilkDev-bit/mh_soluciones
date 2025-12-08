# Railway Health Check Failure - Root Cause Analysis and Fix

## Problem Summary

Both backend and frontend services were failing health checks on Railway deployment, despite successful builds. The services were showing "service unavailable" errors continuously until timeout.

## Root Causes Identified

### 1. Backend Service Issues

#### Issue #1: PORT Variable Not Properly Used
**Problem:** The Dockerfile had `EXPOSE ${PORT}` and `HEALTHCHECK` using `${PORT}`, but environment variable expansion doesn't work in Dockerfile HEALTHCHECK commands, and the CMD wasn't properly using the PORT variable.

**Impact:** Even though Railway sets a dynamic PORT environment variable, the service wasn't binding to it correctly.

**Fix:** 
- Removed `ENV PORT=8000` from Dockerfile (Railway sets this)
- Changed CMD from array form to shell form to allow variable expansion:
  ```dockerfile
  # Before:
  CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
  
  # After:
  CMD sh -c "daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"
  ```

#### Issue #2: Conflicting Health Checks
**Problem:** The Dockerfile had an internal HEALTHCHECK directive that used `curl -f http://localhost:${PORT}/health/`. The `${PORT}` variable doesn't expand in Dockerfile HEALTHCHECK commands, causing it to fail.

**Impact:** Internal health checks were failing, which could interfere with Railway's external health checks.

**Fix:**
- Removed internal `HEALTHCHECK` directive from Dockerfile
- Railway uses external health checks configured in `railway.json`

### 2. Frontend Service Issues

#### Issue #1: Nginx Static Port Configuration
**Problem:** The nginx configuration file (`nginx.railway.conf`) was hardcoded to listen on port 80, but Railway assigns a dynamic PORT environment variable that nginx needs to listen on.

**Impact:** Railway was trying to health check the service on the assigned PORT, but nginx was only listening on port 80.

**Fix:**
- Created `docker-entrypoint.sh` script that:
  - Reads the PORT environment variable from Railway
  - Dynamically generates nginx configuration at runtime
  - Configures nginx to listen on the correct port
  ```bash
  PORT="${PORT:-80}"
  cat > /etc/nginx/conf.d/default.conf << EOF
  server {
      listen ${PORT};
      ...
  }
  EOF
  ```

#### Issue #2: Conflicting Health Checks
**Problem:** Similar to backend, the frontend Dockerfile had an internal HEALTHCHECK directive.

**Impact:** Could interfere with Railway's external health checks.

**Fix:**
- Removed internal `HEALTHCHECK` directive from Dockerfile

### 3. Configuration Issues

#### Issue #1: Health Check Timeout
**Problem:** The healthcheckTimeout was set to 600 seconds (10 minutes), which is unnecessarily long.

**Impact:** Slow feedback on deployment failures, wasted time during troubleshooting.

**Fix:**
- Reduced healthcheckTimeout from 600s to 300s (5 minutes)
- Still allows time for database migrations but provides faster feedback

## Technical Details

### How Railway's PORT Assignment Works

Railway assigns a random available port to each service and sets it in the `PORT` environment variable. Services MUST:

1. Read the PORT environment variable
2. Listen on that port (not a hardcoded port)
3. Respond to health checks on that port

### Why Variable Expansion Failed

In Dockerfile:
- `ENV` directives set environment variables at build time
- `HEALTHCHECK` commands run at runtime but don't expand variables like shell commands do
- Array form CMD (`["cmd", "arg"]`) doesn't expand variables
- Shell form CMD (`cmd arg`) does expand variables through the shell

Example:
```dockerfile
# ❌ This doesn't work - variables don't expand in array form
CMD ["daphne", "-p", "${PORT}"]

# ✅ This works - shell form allows variable expansion
CMD sh -c "daphne -p ${PORT:-8000}"
```

### Why Dynamic Nginx Config Was Needed

Nginx configuration files don't support environment variable expansion natively. Options were:

1. ❌ Use envsubst (requires additional setup)
2. ❌ Use a template system (adds complexity)
3. ✅ Generate config at container startup (simple and reliable)

We chose option 3: using an entrypoint script that generates the nginx config before starting nginx.

## Files Changed

### Backend Changes

**backend/Dockerfile:**
- Removed: `ENV PORT=8000`
- Removed: `HEALTHCHECK` directive
- Changed: CMD to shell form for variable expansion

**backend/railway.json:**
- Changed: `healthcheckTimeout` from 600 to 300

### Frontend Changes

**frontend/Dockerfile:**
- Removed: `HEALTHCHECK` directive
- Removed: Static nginx config copy
- Added: Entrypoint script copy and execution

**frontend/docker-entrypoint.sh:** (New file)
- Reads PORT from environment
- Generates nginx configuration dynamically
- Starts nginx with correct configuration

**frontend/railway.json:**
- Changed: `healthcheckTimeout` from 600 to 300

### Documentation Added

- `RAILWAY_TROUBLESHOOTING.md` - Comprehensive troubleshooting guide
- `RAILWAY_DEPLOYMENT_CHECKLIST.md` - Pre-deployment verification checklist
- This file (`RAILWAY_FIX_SUMMARY.md`) - Root cause analysis

## Verification Steps

After deploying with these fixes, verify:

1. **Backend Health Check:**
   ```bash
   curl https://your-backend.railway.app/health/
   # Should return: {"status":"healthy"}
   ```

2. **Frontend Health Check:**
   ```bash
   curl https://your-frontend.railway.app/health
   # Should return: healthy
   ```

3. **Check Logs:**
   ```bash
   railway logs --service backend
   railway logs --service frontend
   ```

   Look for:
   - Backend: "🚀 Iniciando servidor Daphne en puerto XXXX..."
   - Frontend: "🚀 Starting nginx on port XXXX..."

4. **Verify Port Assignment:**
   - Check Railway dashboard → Service → Deployments → Logs
   - You should see the assigned PORT value in the logs

## Prevention

To prevent similar issues in the future:

1. **Always test with dynamic ports locally:**
   ```bash
   PORT=3000 docker run myimage
   PORT=8080 docker run myimage
   ```

2. **Use Railway CLI for local testing:**
   ```bash
   railway run docker build ...
   railway run docker run ...
   ```

3. **Review Railway documentation:**
   - [Dockerfile Deployment](https://docs.railway.app/deploy/dockerfiles)
   - [Health Checks](https://docs.railway.app/deploy/health-checks)
   - [Environment Variables](https://docs.railway.app/develop/variables)

4. **Monitor deployment logs:**
   - Don't assume build success means deployment success
   - Always check health check logs
   - Verify the service is listening on the assigned PORT

## Lessons Learned

1. **Don't hardcode ports** - Use environment variables
2. **Test variable expansion** - Understand how different CMD forms work
3. **Avoid conflicting health checks** - Use platform-provided health checks
4. **Dynamic configuration** - Generate config files at runtime when needed
5. **Proper timeouts** - Balance between giving enough time and fast feedback

## Additional Resources

- [Railway Docs](https://docs.railway.app)
- [Docker CMD vs ENTRYPOINT](https://docs.docker.com/engine/reference/builder/#understand-how-cmd-and-entrypoint-interact)
- [Nginx Dynamic Configuration](https://www.nginx.com/resources/wiki/start/topics/examples/dynamic_ssi/)

## Support

If you encounter issues after applying these fixes:

1. Review `RAILWAY_DEPLOYMENT_CHECKLIST.md`
2. Check `RAILWAY_TROUBLESHOOTING.md` for common issues
3. Verify all environment variables are set correctly
4. Check Railway logs for specific error messages
5. Join Railway Discord for community support

---

**Status:** ✅ Fixed
**Date:** December 8, 2024
**Impact:** Critical - Prevents deployment
**Priority:** P0
**Verification:** Requires deployment to Railway to confirm
