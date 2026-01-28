# Multi-stage build for @dabb/web using Node.js
# Stage 1: Build
FROM node:22-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy all package.json files for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY packages/ui-shared/package.json ./packages/ui-shared/
COPY packages/i18n/package.json ./packages/i18n/
COPY apps/web/package.json ./apps/web/

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared-types ./packages/shared-types
COPY packages/game-logic ./packages/game-logic
COPY packages/ui-shared ./packages/ui-shared
COPY packages/i18n ./packages/i18n
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build argument for server URL (can be overridden at build time)
ARG VITE_SERVER_URL=http://localhost:3000
ENV VITE_SERVER_URL=$VITE_SERVER_URL

# Build packages sequentially to ensure proper dependency resolution
RUN cd packages/shared-types && pnpm run build && \
    cd ../game-logic && pnpm run build && \
    cd ../i18n && pnpm run build && \
    cd ../ui-shared && pnpm run build && \
    cd ../../apps/web && pnpm run build

# Stage 2: Production with nginx
FROM nginx:alpine AS production

# Add non-root user capability
RUN addgroup -g 1001 -S nginx-app && \
    adduser -S nginx-app -u 1001

# Copy custom nginx config
COPY apps/web/nginx.conf /etc/nginx/nginx.conf

# Copy built static files
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Set proper permissions
RUN chown -R nginx-app:nginx-app /usr/share/nginx/html && \
    chown -R nginx-app:nginx-app /var/cache/nginx && \
    chown -R nginx-app:nginx-app /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx-app:nginx-app /var/run/nginx.pid

USER nginx-app

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
