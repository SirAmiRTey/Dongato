# ==============================================================================
# DONGATO (دنگاتو) - Production Multi-Stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy source files
COPY . .

# Build-time environment variables for Vite client injection
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Compile production bundle (or use existing dist if pre-compiled)
RUN if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then \
      corepack enable && \
      pnpm install --frozen-lockfile && \
      pnpm run build; \
    fi

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime (Nginx)
# ------------------------------------------------------------------------------
FROM nginx:alpine AS runner

# Remove default boilerplate files
RUN rm -rf /usr/share/nginx/html/*

# Copy custom reverse proxy & SPA configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Hardened security: ensure nginx owns required directories
RUN chown -R nginx:nginx /usr/share/nginx/html /var/cache/nginx /var/log/nginx && \
    chmod -R 755 /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Health check to ensure Nginx is actively responding
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
