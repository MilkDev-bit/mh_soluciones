#!/bin/sh
# Exit on error, but with verbose logging
set -e

# Enable verbose logging to track execution
set -x

echo "🚀 Starting Frontend..."
echo "🔍 Environment Detection:"
echo "   - PORT: ${PORT:-80}"
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
# Using quoted EOF to prevent variable expansion, then manually substitute PORT
cat > /etc/nginx/conf.d/default.conf << 'NGINXCONF'
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
if ! nginx -t 2>&1; then
    echo "❌ ERROR: nginx configuration test failed!"
    echo "Configuration file contents:"
    cat /etc/nginx/conf.d/default.conf
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
