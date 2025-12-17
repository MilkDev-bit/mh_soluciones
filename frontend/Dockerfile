# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for environment variables
ARG VITE_API_URL_BASE
ENV VITE_API_URL_BASE=$VITE_API_URL_BASE

# Build the application
RUN npm run build

# Production stage - using specific version to avoid Docker Hub auth issues
FROM nginx:1.25-alpine

# Install wget for optional healthcheck and sed for config processing
RUN apk add --no-cache wget sed

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Clean nginx default HTML files before copying our build
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# PORT Configuration:
# - Railway sets PORT environment variable dynamically (8080 for frontend per railway.json)
# - docker-entrypoint.sh reads $PORT and configures nginx accordingly
# - nginx binds to 0.0.0.0:$PORT to accept connections from Railway's proxy
# - Default fallback is port 8080 if PORT is not set
EXPOSE 8080

# Health Check:
# - Railway uses external health checks via healthcheckPath in railway.json
# - Endpoint: GET /health returns 200 "healthy"
# - Internal HEALTHCHECK directive is not needed

# Start with our custom entrypoint that configures nginx with the correct port
ENTRYPOINT ["/docker-entrypoint.sh"]
