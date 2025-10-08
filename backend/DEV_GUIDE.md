# Claude Relay Service v2 - 开发指南

## 🚀 快速开始

### 1. 环境要求
- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Redis >= 7.0

### 2. 安装依赖
```bash
pnpm install
```

### 3. 配置环境变量
复制示例配置：
```bash
cp .env.example .env
```

编辑 `.env` 文件，设置必要的环境变量：
```env
# 服务器配置
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# JWT 配置
JWT_SECRET=your-secret-key-change-in-production

# 管理员配置（首次启动自动创建）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
```

### 4. 启动 Redis
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

### 5. 启动开发服务器
```bash
pnpm dev
```

服务器将在 `http://localhost:3000` 启动

### 6. 访问 Swagger 文档
```
http://localhost:3000/docs
```

---

## 📂 项目结构

```
backend/
├── src/
│   ├── core/                   # 核心层
│   │   ├── config.ts           # 环境变量配置（Zod schema）
│   │   ├── logger/             # Pino 日志配置
│   │   ├── plugins/            # Fastify 插件
│   │   │   ├── jwt.ts          # JWT 认证插件
│   │   │   └── swagger.ts      # Swagger 文档插件
│   │   ├── utils/              # 工具函数
│   │   │   └── password.ts     # 密码哈希（Argon2）
│   │   └── redis/              # Redis 数据层
│   │       ├── client.ts       # Redis 连接管理
│   │       ├── utils/          # Redis 工具
│   │       │   ├── timezone.ts    # 时区处理
│   │       │   └── encryption.ts  # AES 加密
│   │       └── repositories/   # 数据访问层（6个）
│   │           ├── apikey.repository.ts
│   │           ├── account.repository.ts
│   │           ├── admin.repository.ts
│   │           ├── session.repository.ts
│   │           ├── usage.repository.ts
│   │           └── index.ts
│   ├── shared/                 # 共享代码
│   │   └── types/              # TypeScript 类型（8个文件）
│   │       ├── apikey.ts
│   │       ├── account.ts
│   │       ├── admin.ts
│   │       ├── usage.ts
│   │       ├── session.ts
│   │       ├── redis-keys.ts
│   │       ├── common.ts
│   │       └── index.ts
│   ├── modules/                # 功能模块
│   │   ├── health/             # 健康检查
│   │   │   └── route.ts
│   │   ├── auth/               # 认证模块
│   │   │   ├── route.ts
│   │   │   └── service.ts
│   │   ├── apikey/             # API Key 管理
│   │   │   ├── route.ts
│   │   │   └── service.ts
│   │   ├── account/            # 账户管理
│   │   │   ├── route.ts
│   │   │   └── service.ts
│   │   ├── scheduler/          # 调度器
│   │   │   ├── service.ts
│   │   │   ├── load-balancer.ts
│   │   │   ├── retry.ts
│   │   │   └── index.ts
│   │   └── relay/              # 转发核心
│   │       ├── services/
│   │       │   ├── client-validator.service.ts
│   │       │   ├── headers.service.ts
│   │       │   ├── session-hash.service.ts
│   │       │   ├── proxy-agent.service.ts
│   │       │   ├── usage-capture.service.ts
│   │       │   ├── relay.service.ts
│   │       │   └── index.ts
│   │       └── route.ts
│   └── server.ts               # Fastify 服务器入口
├── tests/                      # 单元测试（14个文件）
│   ├── core/
│   │   ├── redis/
│   │   │   ├── repositories/  # 6个 Repository 测试
│   │   │   └── utils/         # 2个工具测试
│   │   └── utils/             # password 测试
│   └── modules/
│       ├── apikey/            # ApiKeyService 测试
│       ├── account/           # AccountService 测试
│       └── scheduler/         # Scheduler 测试（4个文件）
├── .env.example               # 环境变量示例
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## 🧪 测试

### 运行所有测试
```bash
pnpm test
```

### 运行特定测试文件
```bash
pnpm test tests/modules/apikey/service.test.ts
```

### 监听模式
```bash
pnpm test:watch
```

### 测试覆盖率
当前：**302 个测试，全部通过 ✅**

---

## 🏗️ 构建

### TypeScript 编译
```bash
pnpm build
```

### 代码检查
```bash
pnpm lint
```

### 代码格式化
```bash
pnpm lint:fix
```

---

## 📝 开发规范

### 1. 代码风格
- **语言**: TypeScript 5+ (严格模式)
- **命名**:
  - 文件: `kebab-case.ts`
  - 类: `PascalCase`
  - 函数: `camelCase`
  - 常量: `UPPER_SNAKE_CASE`
- **日志**: 使用 Pino 标准格式 `logger.level({ data }, 'message')`
- **无 emoji**: 代码和日志中不使用 emoji

### 2. 目录结构规范
- **core/**: 核心基础设施（配置、日志、Redis、工具）
- **shared/**: 跨模块共享代码（类型定义）
- **modules/**: 业务功能模块（每个模块独立）

### 3. 模块结构规范
每个业务模块应包含：
```
modules/example/
├── route.ts       # API 路由定义
├── service.ts     # 业务逻辑
└── types.ts       # 模块专有类型（可选）
```

### 4. Repository 规范
- 所有 Repository 必须接受 `Redis` 实例作为构造参数
- 使用 `getClient()` 方法获取 Redis 客户端
- 所有数据访问必须通过 Repository，不直接操作 Redis

### 5. Service 规范
- Service 负责业务逻辑，不直接操作 Redis
- 通过依赖注入接收 Repository 实例
- 所有错误必须有日志记录

### 6. Route 规范
- 使用 Fastify 插件模式
- 必须定义 Swagger schema
- 受保护路由使用 `preHandler: fastify.authenticate`

---

## 🔑 API 端点

### 认证 (Authentication)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/v2/auth/admin/login` | POST | 管理员登录 | - |
| `/api/v2/auth/me` | GET | 获取当前用户信息 | ✅ |
| `/api/v2/auth/change-password` | POST | 修改密码 | ✅ |

### API Key 管理 (API Keys)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/v2/keys` | GET | 列表查询（支持过滤） | ✅ |
| `/api/v2/keys` | POST | 创建 API Key | ✅ |
| `/api/v2/keys/:id` | GET | 获取详情 | ✅ |
| `/api/v2/keys/:id` | PUT | 更新配置 | ✅ |
| `/api/v2/keys/:id` | DELETE | 软删除 | ✅ |
| `/api/v2/keys/:id/restore` | POST | 恢复删除的 Key | ✅ |
| `/api/v2/keys/:id/stats` | GET | 使用统计 | ✅ |

### 账户管理 (Accounts)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/v2/accounts/:platform` | GET | 列表查询（支持过滤） | ✅ |
| `/api/v2/accounts/:platform` | POST | 创建账户 | ✅ |
| `/api/v2/accounts/:platform/:id` | GET | 获取详情 | ✅ |
| `/api/v2/accounts/:platform/:id` | PUT | 更新配置 | ✅ |
| `/api/v2/accounts/:platform/:id` | DELETE | 删除账户 | ✅ |
| `/api/v2/accounts/:platform/:id/toggle-schedulable` | POST | 切换调度状态 | ✅ |
| `/api/v2/accounts/:platform/:id/reset-rate-limit` | POST | 重置限流 | ✅ |
| `/api/v2/accounts/:platform/:id/availability` | GET | 检查可用性 | ✅ |

### API 转发 (Relay)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/v1/messages` | POST | Claude API 转发 | - |

### 健康检查 (Health)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/health` | GET | 服务健康检查 | - |

**总计**: 20 个 API 端点

---

## 🛠️ 常见开发任务

### 添加新的 API 端点
1. 在 `src/modules/your-module/route.ts` 中定义路由
2. 在 `src/modules/your-module/service.ts` 中实现业务逻辑
3. 在 `tests/modules/your-module/` 中编写测试
4. 在 `src/server.ts` 中注册路由

### 添加新的 Repository
1. 在 `src/core/redis/repositories/` 中创建 Repository 类
2. 在 `tests/core/redis/repositories/` 中编写测试
3. 在 `src/core/redis/repositories/index.ts` 中导出

### 添加新的类型定义
1. 在 `src/shared/types/` 中创建类型文件
2. 在 `src/shared/types/index.ts` 中导出

---

## 🐛 调试

### 查看日志
开发模式下，日志会以彩色格式输出到控制台。

### 调试 Redis 数据
```bash
# 连接到 Redis
docker exec -it <redis-container> redis-cli

# 切换到 v2 数据库
SELECT 1

# 查看所有 keys
KEYS *

# 查看特定 key
GET apikey:metadata:cr_xxxx
```

### 调试测试
在测试文件中添加 `console.log` 或使用 VSCode 的调试功能。

---

## 📚 技术文档

### 核心技术栈
- **Fastify**: https://fastify.dev/
- **ioredis**: https://github.com/redis/ioredis
- **Zod**: https://zod.dev/
- **Pino**: https://getpino.io/
- **Vitest**: https://vitest.dev/
- **Argon2**: https://github.com/ranisalt/node-argon2

### 相关文档
- [CLAUDE.md](../CLAUDE.md) - 项目开发计划
- [PROJECT_STATUS.md](./PROJECT_STATUS.md) - 项目状态报告
- [.env.example](./.env.example) - 环境变量说明

---

## 🤝 贡献指南

### 提交代码前
1. 运行测试：`pnpm test`
2. 运行构建：`pnpm build`
3. 运行代码检查：`pnpm lint`
4. 确保所有测试通过且无编译错误

### Git 提交规范
```
feat: 添加新功能
fix: 修复 bug
docs: 文档更新
test: 测试相关
refactor: 重构
chore: 构建/工具相关
```

---

**最后更新**: 2025-10-06
**维护者**: Claude Code Team
