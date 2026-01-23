# Multi-stage build for @dabb/server using Bun
# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock turbo.json ./

# Copy all package.json files for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY apps/server/package.json ./apps/server/

# Install dependencies with Bun
RUN bun install

# Create workspace symlinks manually (bun might not create them in container)
RUN mkdir -p node_modules/@dabb && \
    ln -sf ../../packages/shared-types node_modules/@dabb/shared-types && \
    ln -sf ../../packages/game-logic node_modules/@dabb/game-logic

# Copy source files
COPY packages/shared-types ./packages/shared-types
COPY packages/game-logic ./packages/game-logic
COPY apps/server ./apps/server
COPY tsconfig.base.json ./

# Build packages sequentially to ensure proper dependency resolution
RUN cd packages/shared-types && bun run build && \
    cd ../game-logic && bun run build && \
    cd ../../apps/server && bun run build

# Stage 2: Production
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Copy package.json files and create workspace structure
COPY package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY apps/server/package.json ./apps/server/

# Install production dependencies (without scripts or lockfile checks for partial workspace)
RUN bun install --production --no-save --ignore-scripts

# Create workspace symlinks
RUN mkdir -p node_modules/@dabb && \
    ln -sf ../../packages/shared-types node_modules/@dabb/shared-types && \
    ln -sf ../../packages/game-logic node_modules/@dabb/game-logic

# Copy built files from builder stage
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/game-logic/dist ./packages/game-logic/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Set ownership
RUN chown -R bun:bun /app

USER bun

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "run", "dist/index.js"]
