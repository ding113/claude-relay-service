#!/bin/bash
# v2 开发环境 - 启动 Redis

set -e

CONTAINER_NAME="claude-relay-redis"
NETWORK_NAME="claude-relay-network"
REDIS_IMAGE="redis:7-alpine"
REDIS_PORT="6379"

echo "🔍 Checking Redis container..."

# 检查容器是否存在且正在运行
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "✅ Redis is already running"
    exit 0
fi

# 检查容器是否存在但已停止
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "🔄 Starting existing Redis container..."
    docker start ${CONTAINER_NAME}
    echo "✅ Redis container started"
    exit 0
fi

# 容器不存在，需要创建

echo "🌐 Checking Docker network..."
if ! docker network ls --format '{{.Name}}' | grep -q "^${NETWORK_NAME}$"; then
    echo "📡 Creating network ${NETWORK_NAME}..."
    docker network create ${NETWORK_NAME}
fi

echo "📦 Checking Redis image..."
if ! docker images --format '{{.Repository}}:{{.Tag}}' | grep -q "^${REDIS_IMAGE}$"; then
    echo "⬇️  Pulling Redis image (using proxy)..."
    docker pull docker-pull.ygxz.in/library/redis:7-alpine
    docker tag docker-pull.ygxz.in/library/redis:7-alpine ${REDIS_IMAGE}
fi

echo "🚀 Creating and starting Redis container..."
docker run -d \
  --name ${CONTAINER_NAME} \
  --network ${NETWORK_NAME} \
  -p 127.0.0.1:${REDIS_PORT}:6379 \
  -v "$(pwd)/redis_data:/data" \
  ${REDIS_IMAGE} \
  redis-server --save 60 1 --appendonly yes --appendfsync everysec

echo "⏳ Waiting for Redis to be ready..."
sleep 2

if docker exec ${CONTAINER_NAME} redis-cli ping | grep -q PONG; then
    echo "✅ Redis is ready!"
else
    echo "❌ Redis failed to start"
    exit 1
fi
