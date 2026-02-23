# Multi-stage build for @dabb/server using Node.js
# Stage 1: Build
FROM cgr.dev/chainguard/node:latest-dev AS builder

USER root

# Install pnpm (corepack was removed from Node.js 25+; install pnpm directly)
RUN npm install -g pnpm@latest

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY scripts ./scripts

# Copy all package.json files for dependency resolution
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY apps/server/package.json ./apps/server/

# Install dependencies with pnpm (--ignore-scripts skips postinstall which requires the full workspace)
RUN pnpm install --frozen-lockfile --ignore-scripts

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
FROM cgr.dev/chainguard/node:latest-dev AS production

USER root

# Install pnpm (corepack was removed from Node.js 25+; install pnpm directly)
RUN npm install -g pnpm@latest

WORKDIR /app

# Copy package.json files and create workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/game-logic/package.json ./packages/game-logic/
COPY apps/server/package.json ./apps/server/

# Install production dependencies (ignore scripts to skip husky which is a devDependency)
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/game-logic/dist ./packages/game-logic/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Use numeric UID 65532 (nonroot) — more robust than username-based USER
USER 65532

WORKDIR /app/apps/server

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["node", "-e", "require('http').get('http://localhost:3000/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# Chainguard node ENTRYPOINT is already /usr/bin/node — pass only the script
CMD ["dist/index.js"]
