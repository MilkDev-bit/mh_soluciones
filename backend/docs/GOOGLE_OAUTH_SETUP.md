# Google OAuth Configuration Guide

## Prerequisites

### 1. Redis Setup (Required for Production/Railway)

Google OAuth requires a shared cache across backend instances. Railway may run multiple instances of your backend, so Redis is **REQUIRED**.

#### Option A: Railway Redis Plugin (Recommended)

1. Go to your Railway project
2. Click "New" → "Database" → "Add Redis"
3. Railway will automatically set the `REDIS_URL` environment variable
4. Redeploy your backend service

#### Option B: External Redis (Upstash, Redis Cloud, etc.)

1. Create a Redis instance on your preferred provider
2. Get the Redis connection URL (format: `redis://user:password@host:port`)
3. Set `REDIS_URL` environment variable in Railway
4. Redeploy

### 2. Google Cloud Console Configuration

1. Go to https://console.cloud.google.com/apis/credentials
2. Create or select your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://backend-production-21f4.up.railway.app/api/v1/auth/google/callback/
   ```
4. Save and wait 5 minutes for Google to propagate changes

### 3. Environment Variables

Set these in Railway:

```bash
# Required
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_PROJECT_ID=your-project-id
BACKEND_URL=https://backend-production-21f4.up.railway.app
FRONTEND_URL=https://app.mhsolucionesempresariales.com

# Required for production
REDIS_URL=redis://default:password@host:port
```

## Troubleshooting

### "Application failed to respond"

**Cause**: No Redis configured, using local memory cache with multiple instances.

**Solution**: Add Redis as described above.

### "State not found in cache or expired"

**Causes**:
1. No Redis configured (most common)
2. Redis connection issues
3. User took too long (>10 minutes) to authorize

**Solution**: 
1. Verify `REDIS_URL` is set correctly
2. Check Railway logs for Redis connection errors
3. Ask user to try again

### Callback never reaches backend

**Cause**: Redirect URI mismatch in Google Cloud Console.

**Solution**: Verify the URI in Google Console matches exactly:
```
https://backend-production-21f4.up.railway.app/api/v1/auth/google/callback/
```

## Verification

Check backend logs for:

```
✅ Using Redis cache (shared across instances)
```

If you see:
```
⚠️ Using local memory cache - OAuth may fail with multiple instances
```

Then Redis is NOT configured and OAuth will fail in production.
