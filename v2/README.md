# Claude Relay Service v2

企业级 AI API 网关 - TypeScript 重构版本

## 📁 项目结构

```
v2/
├── backend/      # Fastify + TypeScript 后端
├── frontend/     # Next.js + TypeScript 前端
├── shared/       # 前后端共享代码
└── docker/       # Docker 配置
```

## 🚀 快速开始

### 前置要求

- Node.js >= 20.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
cd v2
pnpm install
```

### 开发模式

```bash
# 同时启动前后端
pnpm dev

# 单独启动后端
pnpm dev:backend

# 单独启动前端
pnpm dev:frontend
```

### 构建

```bash
# 构建所有项目
pnpm build

# 单独构建
pnpm build:backend
pnpm build:frontend
```

## 📊 端口分配

- Backend API: `http://localhost:4000`
- Frontend Web: `http://localhost:3001`
- v1 Backend (原有): `http://localhost:3000`

## 🗄️ 数据库隔离

- v1: Redis DB 0（不变）
- v2: Redis DB 1（新增）

## 🔗 相关文档

- [重构计划](../V2_REFACTORING_PLAN.md)
- [后端文档](./backend/README.md)
- [前端文档](./frontend/README.md)
