# v2 Frontend Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY v2/package.json ./v2/
COPY v2/frontend/package.json ./v2/frontend/

# Install dependencies at workspace root
RUN pnpm install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from workspace root
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY pnpm-workspace.yaml ./
COPY v2/package.json ./v2/
COPY v2/frontend/ ./v2/frontend/

# Build
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN cd v2/frontend && pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/v2/frontend/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/v2/frontend/.next/static ./.next/static
COPY --from=builder --chown=nodejs:nodejs /app/v2/frontend/public ./public

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
