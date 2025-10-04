# Claude Relay Service v2 - Docker Deployment

## 🚀 快速部署

### 前置要求

- Docker 20+
- Docker Compose 2+

### 步骤

1. **配置环境变量**

```bash
cd v2/docker
cp .env.example .env
# 编辑 .env 文件，修改密钥
```

2. **创建网络（如果 v1 未创建）**

```bash
docker network create claude-relay-network
```

3. **启动服务**

```bash
# 在 v2/docker 目录
docker-compose up -d
```

4. **查看日志**

```bash
docker-compose logs -f v2-backend
docker-compose logs -f v2-frontend
```

5. **访问服务**

- Frontend: http://localhost:3002
- Backend API: http://localhost:4000
- Health Check: http://localhost:4000/health

### 停止服务

```bash
docker-compose down
```

## 🔧 配置说明

### 端口分配

| 服务            | 容器端口 | 主机端口 | 说明               |
| --------------- | -------- | -------- | ------------------ |
| v2 Backend      | 4000     | 4000     | API 服务           |
| v2 Frontend     | 3000     | 3002     | Web 界面           |
| Redis           | 6379     | -        | 仅网络内部访问     |
| v1 Backend      | 3000     | 3000     | v1 服务（不影响）  |

### Redis 数据隔离

- v1: Redis DB 0
- v2: Redis DB 1
- 数据完全隔离，互不影响

## 📦 镜像构建

### 手动构建

```bash
# Backend
docker build -f backend.Dockerfile -t claude-relay-v2-backend:local ..

# Frontend
docker build -f frontend.Dockerfile -t claude-relay-v2-frontend:local ..
```

### 推送到 Registry

```bash
docker tag claude-relay-v2-backend:local ghcr.io/ding113/claude-relay-service:v2-backend-latest
docker push ghcr.io/ding113/claude-relay-service:v2-backend-latest
```

## 🔍 故障排查

### 查看容器状态

```bash
docker-compose ps
```

### 查看日志

```bash
# 所有服务
docker-compose logs

# 特定服务
docker-compose logs v2-backend
docker-compose logs v2-frontend
```

### 进入容器

```bash
docker-compose exec v2-backend sh
```

### 检查健康状态

```bash
curl http://localhost:4000/health
```

## 🔄 更新部署

```bash
# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose up -d
```

## 🗑️ 清理

```bash
# 停止并删除容器
docker-compose down

# 删除数据卷（⚠️ 谨慎操作）
docker-compose down -v
```

## 📊 监控

### 资源使用

```bash
docker stats claude-relay-v2-backend claude-relay-v2-frontend
```

### 健康检查

所有服务都配置了健康检查，可通过以下命令查看：

```bash
docker ps --filter "name=claude-relay-v2"
```

## 🔐 安全建议

1. ✅ 修改默认密钥（`V2_JWT_SECRET` 和 `V2_ENCRYPTION_KEY`）
2. ✅ 使用强密码（至少 32 字符）
3. ✅ 生产环境设置 Redis 密码
4. ✅ 使用反向代理（Nginx/Caddy）处理 HTTPS
5. ✅ 定期更新镜像

## 🔗 相关链接

- [v2 重构计划](../../V2_REFACTORING_PLAN.md)
- [Backend 文档](../backend/README.md)
- [Frontend 文档](../frontend/README.md)
