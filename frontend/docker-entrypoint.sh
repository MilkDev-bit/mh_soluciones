#!/bin/sh
# Exit on error, but with verbose logging
set -e

# Enable verbose logging to track execution
set -x

echo "🚀 Starting Frontend..."
echo "🔍 Environment Detection:"
echo "   - PORT: ${PORT:-8080}"
echo "   - VITE_API_URL_BASE: ${VITE_API_URL_BASE:-not set}"
echo "   - RAILWAY_ENVIRONMENT: ${RAILWAY_ENVIRONMENT:-not set}"
echo "   - RAILWAY_SERVICE_NAME: ${RAILWAY_SERVICE_NAME:-not set}"
echo "   - PWD: $(pwd)"
echo "   - USER: $(whoami)"

# Validate that required directories exist
if [ ! -d "/usr/share/nginx/html" ]; then
    echo "❌ ERROR: /usr/share/nginx/html directory does not exist!"
    exit 1
fi

if [ ! -d "/etc/nginx/conf.d" ]; then
    echo "❌ ERROR: /etc/nginx/conf.d directory does not exist!"
    exit 1
fi

# Check if nginx binary exists
if ! command -v nginx > /dev/null 2>&1; then
    echo "❌ ERROR: nginx command not found!"
    exit 1
fi

echo "✅ Pre-flight checks passed"

# Get PORT from environment or default to 8080 (matches Railway configuration)
PORT="${PORT:-8080}"

# Derive BACKEND_ORIGIN from VITE_API_URL_BASE
# VITE_API_URL_BASE format: https://backend-domain/api/v1
# We need to extract: backend-domain (without the /api/v1 part)
if [ -z "$VITE_API_URL_BASE" ]; then
    echo "❌ ERROR: VITE_API_URL_BASE environment variable is not set!"
    echo "   This variable should contain the backend API URL"
    echo "   Example: VITE_API_URL_BASE=https://backend.railway.app/api/v1"
    exit 1
fi

# Extract backend domain from VITE_API_URL_BASE
# Remove protocol (https:// or http://) and everything after the first /
BACKEND_ORIGIN=$(echo "$VITE_API_URL_BASE" | sed 's|^https\?://\([^/]*\).*|\1|')

if [ -z "$BACKEND_ORIGIN" ]; then
    echo "❌ ERROR: Could not extract BACKEND_ORIGIN from VITE_API_URL_BASE"
    echo "   VITE_API_URL_BASE: $VITE_API_URL_BASE"
    exit 1
fi

echo "📍 Derived BACKEND_ORIGIN from VITE_API_URL_BASE: $BACKEND_ORIGIN"
echo "📍 Backend proxy will forward to Railway private network: http://backend.railway.internal:8080"

echo "📍 Configuring nginx to listen on port $PORT"
echo "📍 nginx will bind to 0.0.0.0:$PORT and [::]:$PORT"

# Validate PORT is a valid number
if ! echo "$PORT" | grep -qE '^[0-9]+$'; then
    echo "❌ ERROR: PORT must be a number, got: $PORT"
    exit 1
fi

if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "❌ ERROR: PORT must be between 1 and 65535, got: $PORT"
    exit 1
fi

echo "📝 Writing nginx configuration to /etc/nginx/conf.d/default.conf..."

# Create nginx configuration with the correct port
# Using quoted EOF to prevent variable expansion, then manually substitute PORT and BACKEND_ORIGIN
cat > /etc/nginx/conf.d/default.conf << 'NGINXCONF'
# ============================================================================
# REVERSE PROXY CONFIGURATION
# ============================================================================
# This Nginx configuration implements a reverse proxy to the backend service.
# 
# Purpose:
# - Eliminates exposure of backend URLs in client-side code
# - All API and media requests go through /api/ and /media/ paths
# - Frontend code uses relative URLs (e.g., '/api/v1/...') instead of absolute URLs
# - Backend domain is configured via BACKEND_ORIGIN environment variable
# - No hardcoded URLs in the repository
#
# Security Benefits:
# - Backend URL not exposed to clients
# - Centralized proxy configuration
# - Proper security headers forwarded
# ============================================================================

server {
    listen PORT_PLACEHOLDER;
    listen [::]:PORT_PLACEHOLDER;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    # Enable error logging
    error_log /var/log/nginx/error.log warn;
    access_log /var/log/nginx/access.log;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
    gzip_disable "msie6";

    # Security headers
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check endpoint for Railway (exact match, highest priority)
    location = /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # ========================================================================
    # REVERSE PROXY: API requests to backend
    # ========================================================================
    # Proxies /api/* requests to the backend service
    # Frontend code uses relative URLs like '/api/v1/auth/login'
    # This prevents exposing the backend domain in client code
    location /api/ {
        proxy_pass http://backend.railway.internal:8080/api/;
        
        # Forward original request headers - preserve frontend Host for Django ALLOWED_HOSTS
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Proxy timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Disable buffering for real-time responses
        proxy_buffering off;
    }

    # ========================================================================
    # REVERSE PROXY: Media files from backend
    # ========================================================================
    # Proxies /media/* requests to the backend service
    # Allows serving user-uploaded files through the frontend domain
    location /media/ {
        proxy_pass http://backend.railway.internal:8080/media/;
        
        # Forward original request headers - preserve frontend Host for Django ALLOWED_HOSTS
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Proxy timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Block sensitive files (regex match)
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* \.(env|git|htaccess|htpasswd)$ {
        deny all;
        return 404;
    }

    # Cache static assets (regex match for file extensions)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Cache assets folder (prefix match)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # SPA routing - serve index.html for all other routes (fallback)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
}
NGINXCONF

# Replace PORT_PLACEHOLDER with actual PORT value
sed -i "s/PORT_PLACEHOLDER/${PORT}/g" /etc/nginx/conf.d/default.conf

# Replace BACKEND_ORIGIN_PLACEHOLDER with actual BACKEND_ORIGIN value
sed -i "s|BACKEND_ORIGIN_PLACEHOLDER|${BACKEND_ORIGIN}|g" /etc/nginx/conf.d/default.conf

# Validate that the configuration file was created
if [ ! -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "❌ ERROR: Failed to create nginx configuration file!"
    exit 1
fi

echo "📋 Configuration file created. Contents:"
echo "----------------------------------------"
cat /etc/nginx/conf.d/default.conf
echo "----------------------------------------"

echo "🔍 Testing nginx configuration syntax..."
echo "📝 Running: nginx -t"
NGINX_TEST_OUTPUT=$(nginx -t 2>&1)
NGINX_TEST_EXIT=$?

echo "📋 Nginx test output:"
echo "$NGINX_TEST_OUTPUT"
echo "📊 Nginx test exit code: $NGINX_TEST_EXIT"

if [ $NGINX_TEST_EXIT -ne 0 ]; then
    echo "❌ ERROR: nginx configuration test failed with exit code $NGINX_TEST_EXIT"
    echo "Configuration file contents:"
    cat /etc/nginx/conf.d/default.conf
    echo "Full nginx test output:"
    echo "$NGINX_TEST_OUTPUT"
    exit 1
fi

echo "✅ Nginx configuration test passed"
echo "✅ Nginx configured successfully"
echo "🚀 Starting nginx on port $PORT..."
echo "📡 Nginx will listen on:"
echo "   - IPv4: 0.0.0.0:$PORT"
echo "   - IPv6: [::]:$PORT"
echo "📍 Document root: /usr/share/nginx/html"

# List files in document root for debugging
echo "📂 Files in document root:"
ls -lah /usr/share/nginx/html/ || echo "⚠️  Could not list document root"

# Verify nginx master configuration
echo "🔍 Nginx version and configuration:"
nginx -V 2>&1 | head -5

# Start nginx in the foreground
echo "🎬 Executing: nginx -g 'daemon off;'"
echo "📊 If nginx crashes, check /var/log/nginx/error.log"

# Use exec to replace the shell with nginx, so signals are properly handled
exec nginx -g "daemon off;"
