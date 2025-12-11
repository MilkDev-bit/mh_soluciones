# How to Deploy the Fix to Railway

## Summary of the Issue

The frontend was showing "Bad Request" errors because it couldn't communicate with the backend. The root cause was that the frontend didn't know the backend's URL and was trying to connect to `http://localhost:8000/api/v1` instead of the actual Railway backend URL.

## What Was Fixed

### 1. Frontend Configuration
- **Dockerfile**: Modified to accept `VITE_API_URL_BASE` as a build argument
- **railway.json**: Added `VITE_API_URL_BASE` environment variable that references the backend service

### 2. Backend Configuration
- **railway.json**: Added `FRONTEND_URL` environment variable that references the frontend service for CORS

### 3. How the Communication Works Now

```
┌─────────────┐         Railway Service References        ┌─────────────┐
│   Frontend  │ ←──────────────────────────────────────→  │   Backend   │
│  (Vite/React│         ${{ServiceName.VARIABLE}}        │  (Django)   │
└─────────────┘                                            └─────────────┘
       │                                                          │
       │ VITE_API_URL_BASE:                          FRONTEND_URL:
       │ https://backend-xxx.railway.app/api/v1      https://frontend-xxx.railway.app
       │                                                          │
       └──────────── Baked into JS bundle ───────────────────────┘
                      during npm run build
```

## Deployment Steps

### Important: Service Names Must Match!

Make sure your Railway service names match the references in the railway.json files:

1. **Backend service** must be named: `Backend`
2. **Frontend service** must be named: `mh_soluciones`

If your service names are different, you need to update the railway.json files:
- In `frontend/railway.json`, change `${{Backend.RAILWAY_PUBLIC_DOMAIN}}` to match your backend service name
- In `backend/railway.json`, change `${{mh_soluciones.RAILWAY_PUBLIC_DOMAIN}}` to match your frontend service name

### Deploy to Railway

1. **Push these changes to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Fix Railway frontend-backend communication"
   git push
   ```

2. **Railway will automatically trigger rebuilds** for both services.

3. **Watch the build logs**:
   - Frontend build should show: `VITE_API_URL_BASE=https://backend-production-21f4.up.railway.app/api/v1`
   - Backend should start successfully with CORS configured

4. **Verify the deployment**:
   - Frontend should load without "Bad Request" errors
   - API calls should work (login, data loading, etc.)
   - Check browser console for any errors

## Manual Deployment (if needed)

If Railway doesn't auto-deploy:

1. Go to Railway dashboard
2. Select the **Backend** service → Click "Deploy" 
3. Select the **Frontend** service → Click "Deploy"
4. Wait for both services to complete deployment

## Troubleshooting

### Frontend still shows "Bad Request"

**Check 1**: Verify service names match
```bash
# In Railway dashboard, check:
# - Backend service name should be "Backend" 
# - Frontend service name should be "mh_soluciones"
```

**Check 2**: Check frontend build logs
```
# Look for this line in the build output:
VITE_API_URL_BASE=https://[your-backend-domain]/api/v1

# If it shows localhost, the service reference isn't working
```

**Check 3**: Check backend CORS logs
```
# In backend logs, look for:
🌐 Allowed Hosts: [...list should include your frontend domain...]
```

### How to Check Service Names in Railway

1. Go to your Railway project
2. Each service card shows its name at the top
3. Click on a service → Settings → Name to change it

### Update Service References

If you need to change service names, update these files:

**frontend/railway.json**:
```json
{
  "env": {
    "VITE_API_URL_BASE": "https://${{YOUR_BACKEND_SERVICE_NAME.RAILWAY_PUBLIC_DOMAIN}}/api/v1"
  }
}
```

**backend/railway.json**:
```json
{
  "env": {
    "FRONTEND_URL": "https://${{YOUR_FRONTEND_SERVICE_NAME.RAILWAY_PUBLIC_DOMAIN}}"
  }
}
```

## Expected Results

After successful deployment:

✅ Frontend loads correctly
✅ Login page works
✅ API calls to backend succeed
✅ No CORS errors in browser console
✅ WebSocket connections work (if using real-time features)
✅ No "Bad Request" errors

## Additional Configuration

If you have a custom domain, you may also need to:

1. Add the custom domain to backend CORS settings
2. Update frontend to use the custom domain
3. Set up SSL/TLS certificates (Railway handles this automatically)

See `RAILWAY_DEPLOYMENT.md` for complete documentation.
