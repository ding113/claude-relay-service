#!/bin/bash
# v2 开发环境 - 停止所有服务

set -e

CONTAINER_NAME="claude-relay-redis"

echo "🛑 Stopping v2 development services..."

# 停止 backend 和 frontend (查找端口占用)
echo "📌 Stopping backend (port 4000)..."
lsof -ti:4000 | xargs kill -9 2>/dev/null || echo "   Backend not running"

echo "📌 Stopping frontend (port 3001)..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || echo "   Frontend not running"

# 停止 Redis 容器 (不删除)
echo "📌 Stopping Redis container..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop ${CONTAINER_NAME}
    echo "   ✅ Redis stopped"
else
    echo "   Redis not running"
fi

echo "✅ All services stopped"
echo ""
echo "💡 To restart: pnpm dev"
echo "💡 To remove Redis container: docker rm ${CONTAINER_NAME}"
