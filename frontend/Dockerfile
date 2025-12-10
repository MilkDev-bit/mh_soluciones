# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Install wget for optional healthcheck
RUN apk add --no-cache wget

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# PORT Configuration:
# - Railway sets PORT environment variable dynamically (typically 80 for frontend)
# - docker-entrypoint.sh reads $PORT and configures nginx accordingly
# - nginx binds to 0.0.0.0:$PORT to accept connections from Railway's proxy
# - Default fallback is port 80 if PORT is not set
EXPOSE 80

# Health Check:
# - Railway uses external health checks via healthcheckPath in railway.json
# - Endpoint: GET /health returns 200 "healthy"
# - Internal HEALTHCHECK directive is not needed

# Start with our custom entrypoint that configures nginx with the correct port
ENTRYPOINT ["/docker-entrypoint.sh"]
