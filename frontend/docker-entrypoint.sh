#!/bin/sh
set -e

echo "🚀 Starting Frontend..."
echo "🔍 Environment Detection:"
echo "   - PORT: ${PORT:-80}"
echo "   - RAILWAY_ENVIRONMENT: ${RAILWAY_ENVIRONMENT:-not set}"
echo "   - RAILWAY_SERVICE_NAME: ${RAILWAY_SERVICE_NAME:-not set}"

# Get PORT from environment or default to 80
PORT="${PORT:-80}"

echo "📍 Configuring nginx to listen on port $PORT"
echo "📍 nginx will bind to 0.0.0.0:$PORT and [::]:$PORT"

# Create nginx configuration with the correct port
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

echo "✅ Nginx configured successfully"
echo "🚀 Starting nginx on port $PORT..."

# Start nginx in the foreground
exec nginx -g "daemon off;"
