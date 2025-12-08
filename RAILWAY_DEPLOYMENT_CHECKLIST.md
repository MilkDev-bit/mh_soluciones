# Railway Deployment Checklist

## Pre-Deployment Verification

Before deploying to Railway, ensure all these items are configured correctly.

### 1. Railway Services Setup

- [ ] **PostgreSQL Service** created in Railway project
- [ ] **Redis Service** created in Railway project
- [ ] **Backend Service** created pointing to this repository
- [ ] **Frontend Service** created pointing to this repository

### 2. Backend Environment Variables

Verify these are set in Railway → Backend Service → Variables:

#### Required Variables:
- [ ] `SECRET_KEY` - Generate with: `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`
- [ ] `DATABASE_URL` - Should be: `${{Postgres.DATABASE_URL}}` (auto-linked)
- [ ] `REDIS_URL` - Should be: `${{Redis.REDIS_URL}}` (auto-linked)
- [ ] `DJANGO_SETTINGS_MODULE` - Should be: `config.settings.railway`

#### Application Variables:
- [ ] `FRONTEND_URL` - Your frontend URL (e.g., `https://your-app.railway.app`)
- [ ] `BACKEND_URL` - Your backend URL (e.g., `https://your-api.railway.app`)
- [ ] `ALLOWED_HOSTS` - Should include: `*.railway.app,app.mhsolucionesempresariales.com`

#### Google Drive Integration (if used):
- [ ] `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`

#### Superuser Creation:
- [ ] `DJANGO_SUPERUSER_USERNAME` (default: `admin`)
- [ ] `DJANGO_SUPERUSER_EMAIL` (e.g., `admin@example.com`)
- [ ] `DJANGO_SUPERUSER_PASSWORD` (use a strong password!)

### 3. Frontend Environment Variables

The frontend typically doesn't need environment variables, but verify:

- [ ] No environment variables required (nginx will use Railway's PORT automatically)
- [ ] If you need to pass API URL, set `VITE_API_URL` during build

### 4. Service Configuration

#### Backend Service:
- [ ] **Root Directory**: Leave empty or set to `/`
- [ ] **Build Command**: Not needed (uses Dockerfile)
- [ ] **Start Command**: Not needed (defined in Dockerfile)
- [ ] **Dockerfile Path**: Should be auto-detected from `railway.json`
- [ ] **Watch Paths**: `backend/**` (from `railway.json`)

#### Frontend Service:
- [ ] **Root Directory**: Leave empty or set to `/`
- [ ] **Build Command**: Not needed (uses Dockerfile)
- [ ] **Start Command**: Not needed (defined in Dockerfile)
- [ ] **Dockerfile Path**: Should be auto-detected from `railway.json`
- [ ] **Watch Paths**: `frontend/**` (from `railway.json`)

### 5. Service Linking

Link services so they can reference each other:

- [ ] Backend service is linked to PostgreSQL (for `${{Postgres.DATABASE_URL}}`)
- [ ] Backend service is linked to Redis (for `${{Redis.REDIS_URL}}`)
- [ ] Services can reference each other via internal URLs if needed

### 6. Health Check Configuration

Verify in Railway deployment settings:

#### Backend:
- [ ] Health check path: `/health/`
- [ ] Health check timeout: 300 seconds (from `railway.json`)
- [ ] Service should respond with: `{"status": "healthy"}`

#### Frontend:
- [ ] Health check path: `/health`
- [ ] Health check timeout: 300 seconds (from `railway.json`)
- [ ] Service should respond with: `healthy` (plain text)

### 7. Networking

- [ ] Backend service has a public domain enabled (for API access)
- [ ] Frontend service has a public domain enabled (for web access)
- [ ] Custom domain configured (if using `app.mhsolucionesempresariales.com`)

### 8. Custom Domain Setup (Optional)

If using custom domain `app.mhsolucionesempresariales.com`:

- [ ] Domain added in Railway → Settings → Domains
- [ ] DNS CNAME record points to Railway's provided URL
- [ ] SSL certificate is provisioned (automatic in Railway)
- [ ] Domain added to `ALLOWED_HOSTS` environment variable
- [ ] Domain added to `CSRF_TRUSTED_ORIGINS` (automatic if in `ALLOWED_HOSTS`)

### 9. Post-Deployment Verification

After successful deployment:

- [ ] Backend health check: `curl https://your-backend.railway.app/health/`
  - Should return: `{"status":"healthy"}`
- [ ] Frontend health check: `curl https://your-frontend.railway.app/health`
  - Should return: `healthy`
- [ ] Backend API: `curl https://your-backend.railway.app/api/v1/`
  - Should return API routes or documentation
- [ ] Frontend loads in browser
- [ ] Login functionality works
- [ ] Database connection works (test by creating/viewing data)
- [ ] Static files load correctly
- [ ] Media files upload/download works (if applicable)

### 10. Monitoring

Set up monitoring:

- [ ] Check Railway logs: `railway logs` or in dashboard
- [ ] Monitor deployment status in Railway dashboard
- [ ] Set up alerts (optional, in Railway Pro)
- [ ] Review metrics (CPU, Memory, Network) in Railway dashboard

### 11. Database Migration

If migrating from AWS:

- [ ] Database backup created from AWS RDS
- [ ] Backup restored to Railway PostgreSQL
- [ ] Data integrity verified
- [ ] Test queries run successfully

### Common Issues Checklist

If deployment fails, check:

- [ ] All environment variables are set correctly (no typos)
- [ ] `DATABASE_URL` and `REDIS_URL` are using `${{Service.VARIABLE}}` syntax
- [ ] SECRET_KEY is set and not empty
- [ ] Services are linked together (PostgreSQL, Redis → Backend)
- [ ] railway.json files exist in backend/ and frontend/ directories
- [ ] Dockerfile paths are correct in railway.json
- [ ] Health check paths match the endpoints in code
- [ ] Logs show the actual error (check with `railway logs`)

### Troubleshooting Commands

```bash
# View logs
railway logs
railway logs --service backend
railway logs --service frontend

# Check environment variables
railway variables

# Manually run migrations (if needed)
railway run --service backend python manage.py migrate

# Create superuser manually (if automatic creation fails)
railway run --service backend python manage.py createsuperuser

# Connect to database
railway connect postgres

# Shell into running container
railway shell
```

### Success Criteria

Your deployment is successful when:

- ✅ Backend health check returns 200 OK
- ✅ Frontend health check returns 200 OK
- ✅ No errors in deployment logs
- ✅ Database migrations complete successfully
- ✅ Superuser is created
- ✅ Application is accessible via public URL
- ✅ Static files load correctly
- ✅ API endpoints respond correctly
- ✅ Login/authentication works

### Getting Help

If you're still experiencing issues:

1. Check the logs: `railway logs`
2. Review `RAILWAY_TROUBLESHOOTING.md` for common issues
3. Check Railway status: https://railway.status.io
4. Ask in Railway Discord: https://discord.gg/railway
5. Review Railway docs: https://docs.railway.app

### Security Checklist

Before going to production:

- [ ] `DEBUG` is `False` (automatic in production settings)
- [ ] `SECRET_KEY` is strong and unique
- [ ] Superuser password is strong
- [ ] `ALLOWED_HOSTS` is properly configured (not `*`)
- [ ] CSRF protection is enabled (automatic)
- [ ] SSL/HTTPS is enabled (automatic in Railway)
- [ ] Environment variables don't contain hardcoded secrets
- [ ] Database uses SSL (Railway internal network is secure)
- [ ] No sensitive data in logs or error messages

## Quick Reference

### Generate SECRET_KEY:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Link Services in Railway:
```
Backend Variables:
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REDIS_URL = ${{Redis.REDIS_URL}}
```

### Typical Deployment Time:
- Backend: 3-5 minutes (includes migrations)
- Frontend: 2-3 minutes (includes build)
- Total: ~5-8 minutes for first deployment

### Health Check Timing:
- First check starts after container is running
- Checks every 30 seconds
- Timeout after 300 seconds (5 minutes)
- Allows time for migrations and initialization
