# v2 Frontend Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace config, lockfile, and pnpm config (monorepo)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy frontend package files
COPY frontend/package.json ./frontend/

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy pnpm workspace config (needed for pnpm commands)
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/

# Copy all dependencies (monorepo needs root node_modules)
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY frontend/ ./frontend/

# Build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm --filter frontend build && mkdir -p frontend/public

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/frontend/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/frontend/public ./public

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
