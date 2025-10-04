# Claude Relay Service v2 - 快速启动指南

## ✨ v2 已成功搭建！

v2 项目使用 **TypeScript + Fastify + Next.js** 技术栈，与 v1 完全隔离并行运行。

---

## 🚀 快速开始（2 步）

### 1. 安装依赖

```bash
cd v2
pnpm install
```

### 2. 一键启动（自动启动 Redis + Backend + Frontend）

```bash
pnpm dev
```

就这么简单！脚本会自动：
- ✅ 启动 Redis Docker 容器
- ✅ 启动 Backend API (端口 4000)
- ✅ 启动 Frontend Web (端口 3001)

### （可选）配置环境变量

如需自定义配置：

```bash
# Backend
cd backend
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 和 ENCRYPTION_KEY

# Frontend
cd ../frontend
cp .env.example .env.local
```

---

## 🌐 访问地址

启动成功后，访问以下地址：

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:4000
- **Health Check**: http://localhost:4000/health

---

## 📦 项目结构

```
v2/
├── backend/         # Fastify + TypeScript 后端（端口 4000）
├── frontend/        # Next.js + TypeScript 前端（端口 3001）
├── shared/          # 前后端共享代码
└── docker/          # Docker 配置
```

---

## 🔧 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 🚀 一键启动完整开发环境（Redis + Backend + Frontend） |
| `pnpm stop` | 🛑 停止所有服务 |
| `pnpm dev:backend` | 只启动 Backend |
| `pnpm dev:frontend` | 只启动 Frontend |
| `pnpm build` | 构建生产版本 |
| `pnpm lint` | 代码检查 |

### 手动控制脚本

```bash
# 单独启动 Redis
bash scripts/start-redis.sh

# 停止所有服务
bash scripts/stop-all.sh
```

---

## 🐳 Docker 部署

```bash
cd v2/docker
cp .env.example .env
# 编辑 .env，修改密钥

docker-compose up -d
```

访问：
- Frontend: http://localhost:3002
- Backend: http://localhost:4000

---

## 🗄️ 数据库说明

v2 使用 Redis **DB 1**（v1 使用 DB 0），数据完全隔离。

可以选择性从 v1 读取数据（只读），不会影响 v1 运行。

---

## ⚠️ 重要提示

### 端口分配

| 服务        | 开发端口 | 生产端口 |
| ----------- | -------- | -------- |
| v1 Backend  | 3000     | 3000     |
| v2 Backend  | 4000     | 4000     |
| v2 Frontend | 3001     | 3002     |

### v1 和 v2 并行运行

- ✅ v1 和 v2 可以同时运行
- ✅ 端口不冲突
- ✅ 数据库不冲突（不同 Redis DB）
- ✅ v1 代码完全不受影响

---

## 📖 详细文档

- [v2 重构计划](../V2_REFACTORING_PLAN.md)
- [Backend 文档](backend/README.md)
- [Frontend 文档](frontend/README.md)
- [Docker 文档](docker/README.md)

---

## 🆘 故障排查

### 端口被占用

```bash
# 使用停止脚本
pnpm stop

# 或手动清理
lsof -ti:4000,3001 | xargs kill -9
```

### Redis 启动失败

```bash
# 检查 Docker 是否运行
docker ps

# 查看 Redis 日志
docker logs claude-relay-redis

# 重启 Redis 容器
docker restart claude-relay-redis
```

### 完全重置

```bash
# 停止所有服务
pnpm stop

# 删除 Redis 容器和数据
docker rm -f claude-relay-redis
rm -rf redis_data

# 重新启动
pnpm dev
```

### 依赖安装失败

```bash
# 清理并重装
pnpm store prune
rm -rf node_modules backend/node_modules frontend/node_modules
pnpm install
```

---

## 🎯 下一步

v2 基础架构已搭建完成，接下来可以：

1. ✅ 实现登录认证（阶段 1）
2. ✅ API Key 管理（阶段 2）
3. ✅ 账户管理（阶段 3）
4. ✅ API 转发核心（阶段 4）

参考 [V2_REFACTORING_PLAN.md](../V2_REFACTORING_PLAN.md) 了解详细开发计划。

---

**Happy Coding! 🚀**
