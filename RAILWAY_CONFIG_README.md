# Railway Configuration Guide

## Service Environment Variable References

This project uses Railway's service reference syntax to dynamically connect frontend and backend services.

### How it Works

#### Backend Service (`backend/railway.json`)
- Exposes its own `RAILWAY_PUBLIC_DOMAIN` for other services to reference
- References the Frontend service: `${{Frontend.RAILWAY_PUBLIC_DOMAIN}}`
- Railway automatically provides `RAILWAY_PUBLIC_DOMAIN` for each service

#### Frontend Service (`frontend/railway.json`)
- References the Backend service: `${{Backend.RAILWAY_PUBLIC_DOMAIN}}`
- Uses this to set `VITE_API_URL_BASE` at build time
- The variable is injected during Docker build via ARG/ENV in the Dockerfile

### Service Reference Syntax

Railway uses the following syntax to reference variables from other services:
```
${{SERVICE_NAME.VARIABLE_NAME}}
```

For built-in Railway variables like `RAILWAY_PUBLIC_DOMAIN`:
```
${{RAILWAY_PUBLIC_DOMAIN}}
```

### Important Notes

1. **Service Names**: Must match exactly the service names configured in Railway (case-sensitive)
   - Backend service: `Backend`
   - Frontend service: `Frontend`

2. **Build-time vs Runtime Variables**:
   - `VITE_API_URL_BASE` is a build-time variable (needed during `npm run build`)
   - Railway automatically passes env variables as build args to Dockerfile
   - The Dockerfile accepts it as `ARG VITE_API_URL_BASE`

3. **RAILWAY_PUBLIC_DOMAIN**:
   - Automatically provided by Railway for each service
   - Contains the public domain/URL for that service
   - Must be explicitly exported in `env` section to be accessible to the service itself

### Troubleshooting

If the frontend cannot connect to the backend:
1. Verify service names in Railway match the references in `railway.json`
2. Check that both services are deployed and have public domains assigned
3. Verify the build logs show `VITE_API_URL_BASE` is set correctly
4. Check browser console for the actual API URL being used

### Testing Locally

When testing locally without Railway, the frontend falls back to:
```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL_BASE || 'http://localhost:8000/api/v1';
```

You can set `VITE_API_URL_BASE` in a `.env` file for local development.
