# ==========================================
# Koduck Frontend Dockerfile
# React 18 + TypeScript + Vite 5 + Nginx
# ==========================================

# Stage 1: Build the application
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API base URL
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Build the application
RUN npm run build

# Stage 2: Create the runtime image with Nginx
FROM nginx:alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy custom nginx configuration (main config + server config)
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /usr/local/bin/koduck-entrypoint.sh

# Disable Nginx entrypoint worker_processes autotune to preserve our custom value
ENV NGINX_ENTRYPOINT_WORKER_PROCESSES_AUTOTUNE=

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user (nginx already runs as non-root in alpine)
# Ensure proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chmod +x /usr/local/bin/koduck-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Use custom JSON entrypoint and start Nginx
ENTRYPOINT ["/usr/local/bin/koduck-entrypoint.sh"]
