# Claude Relay Service v2 - 快速启动指南

## ✨ v2 已成功搭建！

v2 项目使用 **TypeScript + Fastify + Next.js** 技术栈，与 v1 完全隔离并行运行。

---

## 🚀 快速开始（3 步）

### 1. 安装依赖

```bash
cd v2
pnpm install
```

### 2. 配置环境变量

```bash
# Backend
cd backend
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 和 ENCRYPTION_KEY

# Frontend
cd ../frontend
cp .env.example .env.local
```

### 3. 启动开发环境

```bash
# 方式 1: 使用便捷脚本（推荐）
cd ../..
bash scripts/dev-v2.sh

# 方式 2: 手动启动
cd v2
pnpm dev  # 同时启动前后端
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

### 开发

```bash
# 同时启动前后端
pnpm dev

# 单独启动
pnpm dev:backend    # 只启动后端
pnpm dev:frontend   # 只启动前端
```

### 构建

```bash
# 构建所有
pnpm build

# 单独构建
pnpm build:backend
pnpm build:frontend
```

### 代码检查

```bash
pnpm lint
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
# 查看端口占用
lsof -i :4000
lsof -i :3001

# 杀死进程
kill -9 <PID>
```

### Redis 连接失败

确保 Redis 运行中：

```bash
# 检查 Redis 状态
redis-cli ping

# 启动 Redis（如未运行）
redis-server
```

### 依赖安装失败

```bash
# 清理缓存
pnpm store prune

# 重新安装
cd v2
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
