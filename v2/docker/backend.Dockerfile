# v2 Backend Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY v2/package.json ./v2/
COPY v2/backend/package.json ./v2/backend/

# Install dependencies at workspace root
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from workspace root
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/v2/backend/node_modules ./v2/backend/node_modules

# Copy source
COPY pnpm-workspace.yaml ./
COPY v2/package.json ./v2/
COPY v2/backend/ ./v2/backend/

# Build
RUN cd v2/backend && pnpm build

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

# Copy workspace configuration files
COPY --chown=nodejs:nodejs pnpm-workspace.yaml ./
COPY --chown=nodejs:nodejs pnpm-lock.yaml ./
COPY --chown=nodejs:nodejs v2/package.json ./v2/
COPY --chown=nodejs:nodejs v2/backend/package.json ./v2/backend/

# Copy production dependencies from deps stage (already filtered by pnpm)
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodejs:nodejs /app/v2/backend/node_modules ./v2/backend/node_modules

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/v2/backend/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
