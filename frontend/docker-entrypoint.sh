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

# Get PORT from environment or default to 80
PORT="${PORT:-80}"

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
# Variable substitution happens in the heredoc because we use unquoted EOF
cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen ${PORT};
    listen [::]:${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html index.htm;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Security headers
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check endpoint for Railway
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Cache static assets (JS, CSS, images, fonts)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache assets folder
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Block sensitive files
    location ~ /\. {
        deny all;
    }

    location ~* (\.env|\.git|\.htaccess|\.htpasswd) {
        deny all;
    }

    # SPA routing - serve index.html for all other routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
EOF

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

# Start nginx in the foreground
echo "🎬 Executing: nginx -g 'daemon off;'"
exec nginx -g "daemon off;"
