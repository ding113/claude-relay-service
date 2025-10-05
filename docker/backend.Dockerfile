# v2 Backend Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace config, lockfile, and pnpm config (monorepo)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy backend package files
COPY backend/package.json ./backend/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy pnpm workspace config (needed for pnpm commands)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Copy all dependencies (monorepo needs root node_modules)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source
COPY backend/ ./backend/

# Build
RUN pnpm --filter backend build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Install dumb-init for signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package files
COPY --chown=nodejs:nodejs backend/package.json ./backend/

# Copy production dependencies
COPY --from=deps --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "backend/dist/server.js"]
