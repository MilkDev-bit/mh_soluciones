#!/bin/sh
set -e

echo "🚀 Starting Frontend..."

# Get PORT from environment or default to 80
PORT="${PORT:-80}"

echo "📍 Configuring nginx to listen on port $PORT"

# Create nginx configuration with the correct port
cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    server_tokens off;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Block sensitive files
    location ~ /\. {
        deny all;
        return 404;
    }

    location ~* (\.env|\.git|\.htaccess|\.htpasswd) {
        deny all;
        return 404;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # SPA routing - serve index.html for all routes
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Cache assets folder
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Favicon
    location = /favicon.ico {
        try_files /favicon.ico =404;
        expires 1y;
        add_header Cache-Control "public";
    }

    # Health check endpoint for Railway
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
        add_header Cache-Control "no-cache";
    }
}
EOF

echo "✅ Nginx configured successfully"
echo "🚀 Starting nginx on port $PORT..."

# Start nginx in the foreground
exec nginx -g "daemon off;"
