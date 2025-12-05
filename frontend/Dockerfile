FROM node:20-alpine AS build

WORKDIR /app

# Railway environment variables for build
ARG VITE_API_BASE_URL
ARG VITE_WS_BASE_URL
ARG VITE_VAPID_PUBLIC_KEY

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

COPY package*.json ./
RUN npm ci --only=production=false

COPY . .

RUN npm run build

# Use specific nginx version for stability
FROM nginx:1.25-alpine

# Create directories and user
RUN mkdir -p /var/log/nginx /var/cache/nginx /run/nginx \
    && chown -R nginx:nginx /var/log/nginx /var/cache/nginx /run/nginx

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Railway uses dynamic port
EXPOSE 80

# Health check for Railway
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]