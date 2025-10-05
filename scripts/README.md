# v2 开发环境脚本

## 🚀 一键启动

```bash
cd v2
pnpm dev
```

这个命令会自动：
1. ✅ 启动 Redis Docker 容器（如果未运行）
2. ✅ 启动 Backend (端口 4000)
3. ✅ 启动 Frontend (端口 3001)

## 🛑 停止所有服务

```bash
cd v2
pnpm stop
```

这会停止：
- Backend 进程
- Frontend 进程
- Redis 容器（保留数据）

## 📜 可用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动完整开发环境 |
| `pnpm dev:backend` | 只启动 backend |
| `pnpm dev:frontend` | 只启动 frontend |
| `pnpm stop` | 停止所有服务 |
| `pnpm build` | 构建生产版本 |
| `pnpm lint` | 代码检查 |

## 🔧 手动脚本

如果需要单独控制 Redis：

```bash
# 启动 Redis
bash scripts/start-redis.sh

# 停止所有服务
bash scripts/stop-all.sh
```

## 📊 服务地址

启动后访问：

- **Backend API**: http://localhost:4000
- **Frontend Web**: http://localhost:3001
- **Health Check**: http://localhost:4000/health

## 🐳 Redis 配置

- **容器名**: claude-relay-redis
- **端口**: 127.0.0.1:6379
- **数据库**: DB 1 (v1 使用 DB 0)
- **数据目录**: `./redis_data`
- **网络**: claude-relay-network

## 💡 提示

- 首次启动会自动通过代理 `docker-pull.ygxz.in` 拉取 Redis 镜像
- Redis 容器使用数据持久化，停止后数据不会丢失
- 如需完全清理：`docker rm -f claude-relay-redis && rm -rf redis_data`
