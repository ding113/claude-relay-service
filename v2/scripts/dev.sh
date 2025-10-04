#!/bin/bash
# v2 开发环境 - 一键启动所有服务

set -e

cd "$(dirname "$0")/.."

# 1. 启动 Redis
bash scripts/start-redis.sh

# 2. 启动 Backend 和 Frontend
echo ""
echo "🚀 Starting backend and frontend..."
pnpm --parallel --filter './backend' --filter './frontend' dev
