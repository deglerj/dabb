# Multi-stage build for @dabb/server using Node.js
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
COPY apps/server/package.json ./apps/server/

# Install dependencies with pnpm
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared-types ./packages/shared-types
COPY packages/game-logic ./packages/game-logic
COPY apps/server ./apps/server
COPY tsconfig.base.json ./

# Build packages sequentially to ensure proper dependency resolution
RUN cd packages/shared-types && pnpm run build && \
    cd ../game-logic && pnpm run build && \
    cd ../../apps/server && pnpm run build

# Stage 2: Production
FROM node:22-alpine AS production

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package.json files and create workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY apps/server/package.json ./apps/server/

# Install production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder stage
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/game-logic/dist ./packages/game-logic/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
