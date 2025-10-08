# Claude Relay Service v2 Backend

Enterprise-grade AI API Gateway - 简化架构，提升可维护性

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.6-black.svg)](https://fastify.dev/)
[![Tests](https://img.shields.io/badge/tests-302%20passed-brightgreen.svg)](./tests)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

---

## ✨ 特性

- 🚀 **高性能**: 基于 Fastify，性能提升 2-3x
- 🔐 **类型安全**: 全量 TypeScript 5+，编译时类型检查
- 🔄 **即时重试**: 任何错误立即切换账户，用户无感
- 📊 **Sticky Session**: 会话粘性支持（15天TTL）
- 🎯 **智能调度**: 优先级 + 负载均衡 + 自动重试
- 📈 **实时统计**: 多维度 Token 使用量统计
- 🔌 **代理支持**: HTTP/HTTPS/SOCKS5 代理
- 📝 **API 文档**: Swagger OpenAPI 自动生成
- ✅ **测试驱动**: 302 个单元测试，覆盖核心逻辑

---

## 📦 安装

### 环境要求
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Redis >= 7.0

### 快速开始
```bash
# 安装依赖
pnpm install

# 复制环境变量
cp .env.example .env

# 启动 Redis（Docker）
docker run -d -p 6379:6379 redis:7-alpine

# 启动开发服务器
pnpm dev
```

服务器将在 `http://localhost:3000` 启动

---

## 🎯 核心功能

### 1. API Key 管理
- 完整的 CRUD 操作
- 软删除 + 恢复机制
- 过期模式（固定时间 / 激活后计时）
- 权限控制（all / claude / codex）
- 速率限制（请求数、成本、并发）

### 2. 账户管理
- 支持 Claude Console 和 Codex
- API Key 自动加密/解密
- 优先级管理
- 模型映射配置
- 代理配置（HTTP/HTTPS/SOCKS5）

### 3. 智能调度
- Sticky Session（会话粘性）
- 7 维度账户筛选
- 优先级 + 轮询负载均衡
- 即时重试机制（最多5次）

### 4. API 转发
- 流式响应（SSE）
- 非流式响应
- Usage 数据捕获
- 客户端验证（Claude Code + Codex）
- 自动错误重试

---

## 📚 API 端点

### 认证
- `POST /api/v2/auth/admin/login` - 管理员登录
- `GET /api/v2/auth/me` - 获取当前用户
- `POST /api/v2/auth/change-password` - 修改密码

### API Key
- `GET /api/v2/keys` - 列表查询
- `POST /api/v2/keys` - 创建
- `GET /api/v2/keys/:id` - 详情
- `PUT /api/v2/keys/:id` - 更新
- `DELETE /api/v2/keys/:id` - 删除
- `POST /api/v2/keys/:id/restore` - 恢复
- `GET /api/v2/keys/:id/stats` - 统计

### 账户
- `GET /api/v2/accounts/:platform` - 列表查询
- `POST /api/v2/accounts/:platform` - 创建
- `GET /api/v2/accounts/:platform/:id` - 详情
- `PUT /api/v2/accounts/:platform/:id` - 更新
- `DELETE /api/v2/accounts/:platform/:id` - 删除
- `POST /api/v2/accounts/:platform/:id/toggle-schedulable` - 切换调度
- `POST /api/v2/accounts/:platform/:id/reset-rate-limit` - 重置限流
- `GET /api/v2/accounts/:platform/:id/availability` - 可用性检查

### 转发
- `POST /api/v1/messages` - Claude API 转发（兼容 v1）

**Swagger 文档**: `http://localhost:3000/docs`

---

## 🧪 测试

```bash
# 运行所有测试
pnpm test

# 监听模式
pnpm test:watch

# 构建
pnpm build

# 代码检查
pnpm lint
```

### 测试覆盖
- **测试文件**: 14 个
- **测试用例**: 302 个
- **通过率**: 100% ✅

---

## 📁 项目结构

```
backend/
├── src/
│   ├── core/              # 核心层（配置、日志、Redis、插件）
│   ├── shared/            # 共享代码（类型定义）
│   ├── modules/           # 业务模块
│   │   ├── health/        # 健康检查
│   │   ├── auth/          # 认证
│   │   ├── apikey/        # API Key 管理
│   │   ├── account/       # 账户管理
│   │   ├── scheduler/     # 调度器
│   │   └── relay/         # API 转发
│   └── server.ts          # 服务器入口
├── tests/                 # 单元测试
├── .env.example           # 环境变量示例
├── package.json
└── tsconfig.json
```

---

## ⚙️ 配置

### 环境变量
```env
# 服务器
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# JWT
JWT_SECRET=your-secret-key

# 管理员（首次启动自动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-password
```

完整配置请参考 [.env.example](.env.example)

---

## 📊 性能指标

- ✅ 调度器选择账户 < 10ms
- ✅ Redis 查询 < 5ms
- ✅ 端到端延迟 < 50ms（不含上游）
- ✅ TypeScript 编译 < 5s
- ✅ 测试运行 < 3s

---

## 🛣️ 开发路线图

- [x] **Phase 1**: 数据层 ✅
- [x] **Phase 2**: 认证系统 ✅
- [x] **Phase 3**: API Key 管理 ✅
- [x] **Phase 4**: 账户管理 ✅
- [x] **Phase 5**: 调度器 ✅
- [x] **Phase 6**: API 转发 ✅
- [ ] **Phase 7**: 统计查询 🚧
- [ ] **Phase 8**: 前端界面 📋
- [ ] **Phase 9**: 生产就绪 📋

详细计划请参考 [CLAUDE.md](../CLAUDE.md)

---

## 📖 文档

- [开发指南](./DEV_GUIDE.md) - 详细的开发文档
- [项目状态](./PROJECT_STATUS.md) - 当前进度报告
- [开发计划](../CLAUDE.md) - 完整的开发计划

---

## 🔧 技术栈

### 核心
- **Node.js 20+** - JavaScript 运行时
- **TypeScript 5+** - 类型安全
- **Fastify 5.x** - Web 框架
- **Redis** - 数据存储（ioredis）

### 工具
- **Zod** - 运行时类型验证
- **Pino** - 结构化日志
- **Vitest** - 单元测试
- **@fastify/jwt** - JWT 认证
- **@fastify/swagger** - API 文档

---

## 🤝 贡献

欢迎贡献代码！提交 PR 前请确保：
1. 所有测试通过 (`pnpm test`)
2. TypeScript 编译无错误 (`pnpm build`)
3. 代码通过 ESLint 检查 (`pnpm lint`)

---

## 📄 许可证

MIT

---

## 🙏 致谢

- [Fastify](https://fastify.dev/) - 高性能 Web 框架
- [ioredis](https://github.com/redis/ioredis) - Redis 客户端
- [Vitest](https://vitest.dev/) - 单元测试框架

---

**版本**: v2.0.0
**状态**: Phase 6 完成（API 转发）
**最后更新**: 2025-10-06
