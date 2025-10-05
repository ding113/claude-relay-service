# Claude Relay Service v2 开发计划

**版本**: v2.0.0
**创建日期**: 2025-10-04
**最后更新**: 2025-10-05
**产品定位**: 企业级 AI API 网关 - 简化架构，提升可维护性
**当前进度**: Phase 3 完成（认证 + API Key 管理），Phase 4-7 待开发

---

## 📋 目录

1. [v2 核心设计原则](#v2-核心设计原则)
2. [v2 与 v1 的差异](#v2-与-v1-的差异)
3. [技术架构](#技术架构)
4. [项目结构](#项目结构)
5. [当前进度](#当前进度)
6. [开发计划](#开发计划)
7. [数据迁移策略](#数据迁移策略)

---

## v2 核心设计原则

### 1. 简化优先
- **不开发 OAuth 模块**：初版只支持 Claude Console API（自定义端点）和 Codex
- **降低复杂度**：专注核心转发逻辑，去除过度设计
- **代码复用**：提取可复用组件，减少重复代码

### 2. 即时重试机制
- **核心逻辑改进**：渠道报错立即切换，无需等待禁用阈值
- **用户无感**：重试过程对用户完全透明
- **会话粘性**：相同优先级的多上游支持会话粘性（Sticky Session）

### 3. 专业化标准
- **标准日志**：使用分级日志（error/warn/info/debug）
- **无 emoji**：代码和日志中不使用任何 emoji，确保专业性
- **类型安全**：全量 TypeScript，编译时类型检查

### 4. v1 兼容性
- **数据结构兼容**：完全复用 v1 的 Redis 数据结构
- **环境变量兼容**：v2 支持所有 v1 环境变量
- **API 兼容**：保持 v1 客户端可无缝切换

---

## v2 与 v1 的差异

### 功能差异

| 特性 | v1 | v2 |
|------|----|----|
| **Claude 接入方式** | OAuth 2.0 + Console API | 仅 Console API |
| **Codex 支持** | 有 | 保留 |
| **错误重试策略** | 达到阈值后禁用渠道 | 任何错误立即重试 |
| **会话粘性** | 基于时间窗口 | 基于会话 Hash (15天TTL) |
| **多上游负载均衡** | 简单轮询 | 智能调度 + Sticky Session |
| **其他平台** | Gemini/OpenAI/Azure/Bedrock | 暂不支持（可后续扩展） |
| **用户系统** | 支持 LDAP 用户管理 | 保留（可选） |
| **Webhook 通知** | 9种平台支持 | 后续实现 |

### 技术差异

| 技术栈 | v1 | v2 |
|--------|----|----|
| **语言** | JavaScript | TypeScript 5+ |
| **框架** | Express | Fastify |
| **数据层** | 直接 ioredis 调用 | Repository 模式 + ioredis |
| **日志** | Winston | Pino |
| **测试** | 无 | Vitest (130+ 单元测试) |
| **类型验证** | 运行时检查 | Zod schema |
| **代码风格** | 使用 emoji | 标准专业日志 |

---

## 技术架构

### 后端技术栈

```
Node.js 20+ + TypeScript 5+
├── 框架: Fastify 5.x (性能优于 Express)
├── 数据层: ioredis (直接使用，不引入 ORM)
├── 验证: Zod (运行时类型验证 + 环境变量解析)
├── 日志: Pino (Fastify 官方推荐)
├── 测试: Vitest + ioredis-mock
├── 加密: Node.js crypto (AES-256-CBC)
└── 认证: JWT (jsonwebtoken)
```

**为什么选 Fastify?**
- 原生 TypeScript 支持
- 性能提升 2-3x（基于 JSON Schema 验证）
- 更好的异步错误处理
- 插件系统更清晰

**为什么不用 ORM?**
- Redis 是 KV 存储，不需要 ORM
- 直接使用 ioredis 更灵活
- Repository 模式已足够抽象数据访问

### 前端技术栈（待定）

```
选项1: 继续使用 v1 的 Vue 3 前端（最小改动）
选项2: 迁移到 Next.js 15 (App Router)
选项3: 纯静态 HTML + Vanilla JS（极简）
```

**决策待定**，取决于前端功能需求。

---

## 项目结构

### 实际结构（扁平化 - monorepo）

```
claude-relay-service/
├── backend/                    # v2 后端（主开发目录）
│   ├── src/
│   │   ├── core/               # 核心层
│   │   │   ├── config.ts       # 环境变量配置（Zod schema）
│   │   │   ├── logger/         # Pino 日志配置
│   │   │   ├── plugins/        # Fastify 插件
│   │   │   │   ├── jwt.ts      # JWT 认证插件 ✅
│   │   │   │   └── swagger.ts  # Swagger 文档插件 ✅
│   │   │   ├── utils/          # 工具函数
│   │   │   │   └── password.ts # 密码哈希（Argon2）✅
│   │   │   └── redis/          # Redis 数据层
│   │   │       ├── client.ts   # Redis 连接管理
│   │   │       ├── utils/      # Redis 工具
│   │   │       │   ├── timezone.ts    # 时区处理 ✅
│   │   │       │   └── encryption.ts  # AES 加密 ✅
│   │   │       └── repositories/       # 数据访问层（6个）
│   │   │           ├── apikey.repository.ts    ✅
│   │   │           ├── account.repository.ts   ✅
│   │   │           ├── admin.repository.ts     ✅
│   │   │           ├── session.repository.ts   ✅
│   │   │           ├── usage.repository.ts     ✅
│   │   │           └── index.ts
│   │   ├── shared/             # 共享代码
│   │   │   └── types/          # TypeScript 类型（8个文件）
│   │   │       ├── apikey.ts   ✅
│   │   │       ├── account.ts  ✅
│   │   │       ├── admin.ts    ✅
│   │   │       ├── usage.ts    ✅
│   │   │       ├── session.ts  ✅
│   │   │       ├── redis-keys.ts ✅
│   │   │       ├── common.ts   ✅
│   │   │       └── index.ts
│   │   ├── modules/            # 功能模块
│   │   │   ├── health/         # 健康检查 ✅
│   │   │   │   └── route.ts
│   │   │   ├── auth/           # 认证模块 ✅
│   │   │   │   ├── route.ts
│   │   │   │   └── service.ts
│   │   │   ├── apikey/         # API Key 管理 ✅
│   │   │   │   ├── route.ts
│   │   │   │   └── service.ts
│   │   │   ├── account/        # 账户管理（待开发）
│   │   │   ├── relay/          # 转发核心（待开发）
│   │   │   └── stats/          # 统计查询（待开发）
│   │   └── server.ts           # Fastify 服务器入口 ✅
│   ├── tests/                  # 单元测试（9个文件）
│   │   ├── core/
│   │   │   ├── redis/
│   │   │   │   ├── repositories/  # 6个 Repository 测试
│   │   │   │   └── utils/         # 2个工具测试
│   │   │   └── utils/             # password 测试
│   │   └── modules/
│   │       └── apikey/            # ApiKeyService 测试
│   ├── .env.example            # 环境变量示例
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
│
├── frontend/                   # v2 前端（Next.js 15）
│   ├── src/
│   ├── package.json
│   └── next.config.ts
│
├── v1-reference/               # v1 代码参考（.gitignore）
├── docker/                     # Docker 配置
├── scripts/                    # 工具脚本
├── redis_data/                 # 本地 Redis 数据（.gitignore）
├── pnpm-workspace.yaml         # pnpm monorepo 配置
├── CLAUDE.md                   # 本文档
└── package.json                # 根 package.json
```

**说明**:
- 采用 pnpm workspace monorepo 结构
- backend 和 frontend 分离，独立的 package.json
- v1 代码已移至 v1-reference（仅供参考，不提交）
- 所有源码在 backend/src，测试在 backend/tests

---

## 当前进度

### ✅ 已完成（Phase 1 - 数据层）

#### 1. 基础设施搭建
- [x] TypeScript 项目配置（tsconfig.json）
- [x] Fastify 服务器搭建（src/server.ts）
- [x] Pino 日志系统配置（src/core/logger）
- [x] Redis 客户端封装（src/core/redis/client.ts）
- [x] Vitest 测试环境配置

#### 2. 环境变量配置（完全兼容 v1）
- [x] Zod schema 定义（src/core/config.ts）
- [x] 支持所有 v1 环境变量（80+ 配置项）
- [x] 类型安全的配置导出
- [x] .env.example 更新

#### 3. TypeScript 类型系统
- [x] `apikey.ts` - API Key 数据类型
- [x] `account.ts` - 账户数据类型（Claude Console + Codex）
- [x] `usage.ts` - 使用统计类型
- [x] `session.ts` - 会话映射类型
- [x] `redis-keys.ts` - Redis Key 生成器（完全兼容 v1）
- [x] `common.ts` - 通用类型定义

#### 4. Redis 工具类
- [x] `timezone.ts` - 时区处理（UTC+8 可配置）
  - `getDateInTimezone()` - 获取时区时间
  - `getDateStringInTimezone()` - 格式化日期 (YYYY-MM-DD)
  - `getMonthStringInTimezone()` - 格式化月份 (YYYY-MM)
  - `getHourStringInTimezone()` - 格式化小时 (YYYY-MM-DD-HH)
- [x] `encryption.ts` - AES-256-CBC 加密/解密（完全兼容 v1）
  - `encryptSensitiveData()` - 加密敏感数据
  - `decryptSensitiveData()` - 解密敏感数据
  - `hashSensitiveData()` - SHA256 哈希（加盐）

#### 5. Repository 数据访问层（6 个 Repository）
- [x] `ApiKeyRepository` - API Key 数据访问
  - CRUD 操作
  - 哈希映射优化（O(1) 查找）
  - 批量查询（Pipeline 优化）
- [x] `AccountRepository` - 账户数据访问
  - 支持 Claude Console 和 Codex
  - 自动加密/解密 API Key
  - 共享账户集合管理
- [x] `SessionRepository` - 会话映射管理
  - Sticky Session 支持（15 天 TTL）
  - 智能续期（14 天阈值）
  - 批量操作优化
- [x] `UsageRepository` - 使用统计管理
  - 多维度统计（总计/日/月/小时）
  - Token 分类统计（input/output/cache/ephemeral）
  - 成本跟踪
  - 自动过期策略（日: 90天，月: 365天，小时: 7天）
- [x] `AdminRepository` - 管理员凭据管理
  - 凭据存储/更新
  - 密码哈希验证（Argon2）

#### 6. 单元测试（Test-Driven Development）
- [x] `timezone.test.ts` - 15 个测试 ✅
- [x] `encryption.test.ts` - 19 个测试 ✅
- [x] `password.test.ts` - 19 个测试 ✅
- [x] `apikey.repository.test.ts` - 29 个测试 ✅
- [x] `account.repository.test.ts` - 30 个测试 ✅
- [x] `admin.repository.test.ts` - 18 个测试 ✅
- [x] `session.repository.test.ts` - 21 个测试 ✅
- [x] `usage.repository.test.ts` - 16 个测试 ✅
- [x] `apikey.service.test.ts` - 36 个测试 ✅
- **总计**: 198 个测试（9 个测试文件），全部通过 ✅
- **测试工具**: Vitest + ioredis-mock（完全隔离）

#### 7. 代码质量
- [x] TypeScript 编译无错误
- [x] 所有日志使用 Pino 标准格式：`logger.level({ data }, 'message')`
- [x] 移除所有 emoji，使用标准日志
- [x] 类型覆盖率 100%（严格模式）

### 📊 当前状态

```
Phase 1: 数据层 ✅ 100% 完成
- 类型系统 ✅
- 工具类 ✅
- Repository 层 ✅ (6 个 Repository)
- 单元测试 ✅ (198 个测试)
- 环境配置 ✅

Phase 2: 认证与管理员登录 ✅ 100% 完成
- JWT 插件 ✅
- 管理员凭据管理 ✅
- 登录/修改密码 API ✅
- AdminRepository ✅

Phase 3: API Key 管理 ✅ 100% 完成
- ApiKeyService ✅
- 7 个 API 端点 ✅
- Swagger 文档 ✅
- 单元测试 ✅

Phase 4: 账户管理 🚧 待开发
Phase 5: 调度器 🚧 待开发
Phase 6: API 转发 🚧 待开发
Phase 7: 统计查询 🚧 待开发
```

---

## 已实现的 API 端点

### 认证模块 (Authentication)
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

### 健康检查 (Health)
| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/health` | GET | 服务健康检查 | - |

**总计**: 11 个 API 端点

**Swagger 文档**: `http://localhost:3000/docs`（开发环境）

---

## 开发计划

### Phase 2: 认证与管理员登录 ✅ 已完成

**目标**: 实现管理员登录，支持 JWT 认证

**任务清单**:
- [x] 实现 JWT 中间件（基于 @fastify/jwt）
- [x] 管理员凭据管理
  - [x] 环境变量配置（ADMIN_USERNAME/ADMIN_PASSWORD）
  - [x] 自动生成管理员账号（首次启动）
  - [x] BCrypt 密码哈希（使用 argon2，更安全）
  - [x] `AdminRepository` - 管理员凭据数据访问
- [x] 登录 API
  - [x] `POST /api/v2/auth/admin/login` - 管理员登录
  - [x] `GET /api/v2/auth/me` - 当前用户信息
  - [x] `POST /api/v2/auth/change-password` - 修改密码
- [x] 受保护路由中间件（`fastify.authenticate`）
- [x] 单元测试（AdminRepository: 18 个测试）

**已实现的 API**:
```typescript
POST /api/v2/auth/admin/login
Body: { username: string, password: string }
Response: { token: string, expiresIn: number }

GET /api/v2/auth/me
Headers: { Authorization: 'Bearer <token>' }
Response: { username: string, role: 'admin' }

POST /api/v2/auth/change-password
Headers: { Authorization: 'Bearer <token>' }
Body: { currentPassword: string, newPassword: string }
Response: { message: string }
```

**验收标准**:
- ✅ 管理员登录成功，返回 JWT Token
- ✅ Token 验证中间件正常工作（JWT 插件）
- ✅ 受保护路由拒绝未授权请求
- ✅ 自动生成管理员凭据（首次启动）
- ✅ 密码修改功能完整
- ✅ 单元测试覆盖率 100%（AdminRepository）

---

### Phase 3: API Key 管理模块 ✅ 已完成

**目标**: 完整的 API Key CRUD + 使用统计查询

**任务清单**:
- [x] API Key Service 业务逻辑
  - [x] 创建 API Key（生成、哈希、存储）
  - [x] 查询 API Key（列表、详情、统计）
  - [x] 更新 API Key（配置、状态）
  - [x] 删除 API Key（软删除 + 恢复）
  - [x] 批量操作支持（通过 Repository Pipeline）
- [x] API 端点实现
  - [x] `GET /api/v2/keys` - 列表（过滤：includeDeleted, isActive, permissions）
  - [x] `POST /api/v2/keys` - 创建
  - [x] `GET /api/v2/keys/:id` - 详情
  - [x] `PUT /api/v2/keys/:id` - 更新
  - [x] `DELETE /api/v2/keys/:id` - 软删除
  - [x] `POST /api/v2/keys/:id/restore` - 恢复
  - [x] `GET /api/v2/keys/:id/stats` - 使用统计
- [x] 完整的 API Key 配置支持
  - [x] 过期模式（固定时间 / 激活后计时）
  - [x] 账户绑定（Claude Console / Codex）
  - [x] 权限控制（all / claude / codex）
  - [x] 模型限制（restrictedModels 白名单）
  - [x] 客户端限制（allowedClients 白名单）
  - [x] 速率限制（请求数、成本、并发）
  - [x] 成本限制（每日、总计、周度 Opus）
- [x] Swagger 文档（完整 OpenAPI Schema）
- [x] 单元测试（36 个测试，覆盖所有 Service 方法）

**已实现的 API**:
```typescript
POST /api/v2/keys - 创建 API Key（返回明文 Key，仅此一次）
GET /api/v2/keys - 列表查询（支持过滤）
GET /api/v2/keys/:id - 获取详情
PUT /api/v2/keys/:id - 更新配置
DELETE /api/v2/keys/:id - 软删除
POST /api/v2/keys/:id/restore - 恢复删除的 Key
GET /api/v2/keys/:id/stats - 使用统计
```

**验收标准**:
- ✅ 完整 CRUD 功能正常
- ✅ 哈希映射查找性能 < 10ms（O(1) 查找）
- ✅ 统计数据准确（集成 UsageRepository）
- ✅ 软删除/恢复机制完整
- ✅ 测试覆盖率 100%（Service 层）
- ✅ Swagger 文档完整

---

### Phase 4: 账户管理模块

**目标**: Claude Console 和 Codex 账户管理

**任务清单**:
- [ ] Account Service 业务逻辑
  - [ ] 账户 CRUD
  - [ ] 账户状态管理（可调度/不可调度）
  - [ ] 优先级管理
  - [ ] 模型映射配置
  - [ ] 代理配置支持
- [ ] API 端点实现
  - [ ] `GET /api/v2/accounts/:platform` - 列表（platform: claude-console | codex）
  - [ ] `POST /api/v2/accounts/:platform` - 创建
  - [ ] `GET /api/v2/accounts/:platform/:id` - 详情
  - [ ] `PUT /api/v2/accounts/:platform/:id` - 更新
  - [ ] `DELETE /api/v2/accounts/:platform/:id` - 删除
  - [ ] `POST /api/v2/accounts/:platform/:id/test` - 测试连接
- [ ] 健康检查机制
- [ ] 单元测试 + 集成测试

**验收标准**:
- ✅ 账户 CRUD 功能正常
- ✅ API Key 自动加密/解密
- ✅ 测试连接功能可用
- ✅ 测试覆盖率 > 80%

---

### Phase 5: 统一调度器（核心）

**目标**: 实现智能调度 + 即时重试机制

**任务清单**:
- [ ] 调度器核心逻辑
  - [ ] 账户筛选（平台匹配、模型匹配、可调度状态）
  - [ ] 优先级排序
  - [ ] Sticky Session 支持（基于会话 Hash）
  - [ ] 负载均衡（相同优先级轮询）
- [ ] 即时重试机制
  - [ ] 错误检测（网络错误、429、500、529 等）
  - [ ] 自动切换账户（无需阈值，立即重试）
  - [ ] 用户无感（透明重试）
  - [ ] 最大重试次数限制（避免死循环）
- [ ] 会话映射管理
  - [ ] 创建/更新会话映射（15 天 TTL）
  - [ ] 智能续期（14 天阈值）
  - [ ] 会话清理（过期自动删除）
- [ ] 单元测试 + 集成测试

**核心算法**:
```typescript
async function selectAccount(request: Request): Promise<Account> {
  // 1. 检查 Sticky Session
  const sessionHash = extractSessionHash(request)
  if (sessionHash) {
    const mapping = await sessionRepo.get(sessionHash)
    if (mapping) {
      await sessionRepo.extendIfNeeded(sessionHash) // 智能续期
      return getAccountById(mapping.accountId)
    }
  }

  // 2. 筛选可用账户
  const accounts = await accountRepo.findAll(request.platform)
  const available = accounts
    .filter(a => a.schedulable)
    .filter(a => supportsModel(a, request.model))
    .sort((a, b) => a.priority - b.priority)

  // 3. 负载均衡（相同优先级轮询）
  const selected = selectWithLoadBalance(available)

  // 4. 创建会话映射
  if (sessionHash) {
    await sessionRepo.set(sessionHash, selected.id, selected.accountType)
  }

  return selected
}

async function retryOnError(request: Request): Promise<Response> {
  const maxRetries = 5
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const account = await selectAccount(request)

    try {
      const response = await forwardRequest(request, account)
      return response // 成功，直接返回
    } catch (error) {
      lastError = error
      logger.warn({ attempt, accountId: account.id, error }, 'Request failed, retrying')

      // 不禁用账户，直接重试（核心改进）
      continue
    }
  }

  // 所有账户都失败
  throw new Error(`All retries failed: ${lastError.message}`)
}
```

**验收标准**:
- ✅ Sticky Session 正常工作
- ✅ 错误自动重试，用户无感
- ✅ 会话续期机制正常
- ✅ 负载均衡正确
- ✅ 测试覆盖率 > 80%

---

### Phase 6: API 转发核心

**目标**: 实现 Claude Console API 转发（流式 + 非流式）

**任务清单**:
- [ ] HTTP 客户端封装
  - [ ] 支持代理（HTTP/SOCKS5）
  - [ ] 超时控制
  - [ ] 连接池管理
- [ ] 转发逻辑
  - [ ] 请求头转换（Claude Code Headers 支持）
  - [ ] 流式响应（SSE）
  - [ ] 非流式响应
  - [ ] Usage 数据捕获
- [ ] API 端点实现
  - [ ] `POST /api/v1/messages` - Claude 格式（兼容 v1）
  - [ ] `GET /api/v1/models` - 模型列表
- [ ] 统计更新
  - [ ] 实时更新 Token 使用量
  - [ ] 成本计算
  - [ ] 请求计数
- [ ] 错误处理
  - [ ] 统一错误格式
  - [ ] 调度器集成（自动重试）
- [ ] 集成测试

**验收标准**:
- ✅ 流式响应正常（SSE）
- ✅ 非流式响应正常
- ✅ Usage 数据准确
- ✅ 统计实时更新
- ✅ 错误自动重试
- ✅ 集成测试通过

---

### Phase 7: 统计查询模块

**目标**: 使用统计查询 API

**任务清单**:
- [ ] Stats Service 业务逻辑
  - [ ] 按 Key 查询统计
  - [ ] 按日期范围查询
  - [ ] 按模型聚合
  - [ ] 成本统计
- [ ] API 端点实现
  - [ ] `GET /api/v2/stats/keys/:id` - Key 统计
  - [ ] `GET /api/v2/stats/usage` - 使用统计（多维度）
  - [ ] `GET /api/v2/stats/cost` - 成本统计
- [ ] 单元测试 + 集成测试

**验收标准**:
- ✅ 统计数据准确
- ✅ 查询性能 < 100ms
- ✅ 测试覆盖率 > 80%

---

### Phase 8: 前端开发（可选）

**目标**: 简化版管理界面

**选项**:
1. **复用 v1 前端**（最小改动）- 推荐
2. **纯静态 HTML + Vanilla JS**（极简）
3. **Next.js 15**（现代化）

**核心页面**:
- 管理员登录
- API Key 管理
- 账户管理
- 使用统计

---

### Phase 9: 生产就绪

**任务清单**:
- [ ] Docker 镜像构建
- [ ] Docker Compose 配置
- [ ] 性能测试（QPS 基准）
- [ ] 安全审计
- [ ] 部署文档
- [ ] 监控配置（可选）

---

## 数据迁移策略

### 推荐方案：双 DB 模式

```
v1: Redis DB 0
v2: Redis DB 1
```

**优点**:
- v1 和 v2 完全隔离
- 可以随时回滚
- 数据结构兼容（无需迁移）

**缺点**:
- 需要手动同步数据（可选）

**迁移脚本**（可选）:
```bash
# 从 v1 (DB 0) 同步数据到 v2 (DB 1)
npm run migrate:v1-to-v2
```

---

## 成功指标

### 功能指标
- ✅ 完全兼容 v1 环境变量
- ✅ 完全兼容 v1 Redis 数据结构
- ✅ 支持 v1 客户端无缝切换

### 性能指标
- ✅ 调度器选择账户 < 10ms
- ✅ Redis 查询 < 5ms
- ✅ 端到端延迟 < 50ms（不含上游）

### 质量指标
- ✅ 单元测试覆盖率 100%（Repository 层）
- ✅ TypeScript 类型覆盖率 100%（严格模式）
- ✅ 零 TypeScript 编译错误
- ✅ 零 ESLint 错误

---

## 总结

### 核心改进
1. **即时重试** - 任何错误立即切换账户，用户无感
2. **类型安全** - 全量 TypeScript，编译时检查
3. **专业化** - 标准日志，无 emoji
4. **测试驱动** - 198 个单元测试，覆盖核心逻辑
5. **Monorepo** - pnpm workspace，前后端分离
6. **API 文档** - Swagger OpenAPI 自动生成

### 开发进度（2025-10-05）
- **Phase 1（数据层）**: ✅ 100% 完成
  - 6 个 Repository
  - 8 个 TypeScript 类型定义
  - 加密/时区/密码工具
- **Phase 2（认证）**: ✅ 100% 完成
  - JWT 认证
  - 管理员登录/密码修改
  - 3 个 API 端点
- **Phase 3（API Key 管理）**: ✅ 100% 完成
  - ApiKeyService
  - 7 个 API 端点
  - 完整 CRUD + 统计
- **Phase 4（账户管理）**: 📋 待开发
- **Phase 5（调度器）**: 📋 待开发
- **Phase 6（API 转发）**: 📋 待开发
- **Phase 7（统计查询）**: 📋 待开发
- **Phase 8（前端）**: 🚧 Next.js 15 搭建中
- **Phase 9（生产就绪）**: 📋 待开发

### 当前统计
- **代码文件**: 28 个 TypeScript 文件
- **测试文件**: 9 个测试文件
- **测试用例**: 198 个（全部通过 ✅）
- **API 端点**: 11 个（含 Swagger 文档）
- **Repositories**: 6 个（数据访问层）
- **Services**: 2 个（业务逻辑层）

### 时间估算
- **已完成**: Phase 1-3（约 3 周）
- **剩余工作**: Phase 4-7（约 3-4 周）
- **完整版**: Phase 1-9（约 2-3 周）
- **预计总计**: 8-10 周

---

**文档版本**: v2.1
**最后更新**: 2025-10-05
**维护者**: Claude Code Team
**项目状态**: Phase 3 完成，进入 Phase 4 开发
- 项目使用pnpm.