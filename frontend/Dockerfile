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

# Railway assigns PORT dynamically
EXPOSE 8080

# Note: Railway uses external health checks via healthcheckPath in railway.json
# Internal HEALTHCHECK is not needed

# Start with our custom entrypoint that configures the port
ENTRYPOINT ["/docker-entrypoint.sh"]
