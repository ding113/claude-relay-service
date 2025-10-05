# v2 Backend Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/pnpm-lock.yaml ./backend/

# Install dependencies
RUN cd backend && pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source
COPY backend/ ./backend/

# Build
RUN cd backend && pnpm build

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
COPY --from=builder --chown=nodejs:nodejs /app/backend/dist ./dist

# Create logs directory
RUN mkdir -p logs && chown nodejs:nodejs logs

USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
