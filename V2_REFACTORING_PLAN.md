# Claude Relay Service v2 重构计划

**版本**: v2.0.0
**创建日期**: 2025-10-04
**产品定位**: 从 Prototype 到 Production-Ready 的企业级 AI API 网关

---

## 📋 目录

1. [当前功能清单](#当前功能清单)
2. [技术架构](#技术架构)
3. [项目结构](#项目结构)
4. [分阶段实施计划](#分阶段实施计划)
5. [数据迁移策略](#数据迁移策略)
6. [风险控制](#风险控制)
7. [成功指标](#成功指标)
8. [MVP范围定义](#mvp范围定义)

---

## 当前功能清单

### 核心平台支持 (8种)

1. **Claude Official** - OAuth 2.0 PKCE 认证
2. **Claude Console** - SessionKey 认证
3. **CCR (Claude Code Relay)** - 自定义中继
4. **Gemini** - Google OAuth 认证
5. **OpenAI** - 标准 API Key
6. **OpenAI Responses** - 特殊格式支持
7. **Azure OpenAI** - Azure 认证
8. **AWS Bedrock** - AWS IAM 认证

### 1. API Key 管理系统

**核心功能**:

- ✅ CRUD 操作（创建、读取、更新、删除）
- ✅ 批量操作（批量创建、批量编辑、批量删除）
- ✅ 软删除 + 恢复机制（回收站功能）
- ✅ 过期管理（设置过期时间、续期、自动清理）
- ✅ 标签系统（分类管理）
- ✅ 权限控制（服务权限：all/claude/gemini/openai）
- ✅ 模型限制（黑名单模式）
- ✅ 哈希映射（O(1) 查找优化）

**高级功能**:

- ✅ 滑动窗口限流（小时/天/周/月多维度）
- ✅ 用户关联（支持 LDAP 集成）
- ✅ 成本跟踪（多维度费用统计）
- ✅ 使用统计（请求数、Token、成本）
- ✅ 客户端标识（SillyTavern、Claude Code等）

### 2. 账户管理系统

**Claude OAuth 账户**:

- ✅ OAuth 2.0 PKCE 完整流程
- ✅ 自动 Token 刷新（10秒提前策略）
- ✅ 代理支持（SOCKS5/HTTP）
- ✅ Opus 权限检测
- ✅ 订阅信息管理（Pro/Max/Free）
- ✅ 会话窗口管理（基于UTC时间）
- ✅ 限流状态自动恢复

**其他账户类型**:

- ✅ Claude Console（SessionKey管理）
- ✅ CCR 账户
- ✅ Gemini OAuth
- ✅ OpenAI API Key
- ✅ Azure OpenAI
- ✅ Bedrock (AWS IAM)

**账户组管理**:

- ✅ 分组功能（按平台分组）
- ✅ 批量账户管理
- ✅ 成员管理

### 3. 统一调度系统

**智能账户选择**:

- ✅ 模型匹配（Opus权限检测）
- ✅ Sticky Session（会话粘性）
- ✅ 限流感知（自动跳过受限账户）
- ✅ 负载均衡
- ✅ 错误隔离（自动标记故障账户）

**调度器类型**:

- ✅ Unified Claude Scheduler
- ✅ Unified Gemini Scheduler
- ✅ Unified OpenAI Scheduler

### 4. API 转发与兼容层

**标准 API**:

- ✅ `/api/v1/messages` - Claude 格式
- ✅ `/gemini/*` - 标准 Gemini 格式
- ✅ `/openai/*` - OpenAI 标准格式

**兼容层**:

- ✅ OpenAI → Claude 格式转换
- ✅ OpenAI → Gemini 格式转换
- ✅ Claude Code Headers 支持
- ✅ Azure OpenAI 兼容

**流式支持**:

- ✅ SSE (Server-Sent Events)
- ✅ 真实 Usage 数据捕获
- ✅ 客户端断开自动清理
- ✅ 背压处理 (Backpressure)

### 5. 使用统计与成本跟踪

**多维度统计**:

- ✅ 按日期（日/周/月）
- ✅ 按 API Key
- ✅ 按模型
- ✅ 按用户
- ✅ 批量查询优化

**成本计算**:

- ✅ 动态定价服务
- ✅ Input/Output Token 分别计费
- ✅ 实时成本更新
- ✅ 费用初始化服务

**数据存储**:

- ✅ Redis Hash 优化存储
- ✅ 时区感知（UTC+8 可配置）
- ✅ 定期清理任务

### 6. 用户系统

**用户管理**:

- ✅ CRUD 操作
- ✅ 角色权限（admin/user）
- ✅ 状态管理（启用/禁用）
- ✅ LDAP 集成
- ✅ 会话管理（JWT Token）

**用户功能**:

- ✅ 独立登录入口
- ✅ 个人仪表板
- ✅ API Key 自助管理
- ✅ 使用统计查看

### 7. Webhook 通知系统

**支持平台 (9种)**:

- ✅ 企业微信 (WeChat Work)
- ✅ 钉钉 (DingTalk)
- ✅ 飞书 (Feishu)
- ✅ Slack
- ✅ Discord
- ✅ Telegram
- ✅ Bark (iOS)
- ✅ SMTP (邮件)
- ✅ Custom Webhook

**通知类型**:

- ✅ 系统错误
- ✅ 账户状态变更
- ✅ 限流告警
- ✅ 费用告警
- ✅ 测试通知

### 8. Web 管理界面 (Vue 3 SPA)

**页面清单**:

1. **Dashboard** - 系统概览、使用趋势、模型分布
2. **API Keys** - Key 管理、批量操作、使用详情
3. **Accounts** - 多账户管理、OAuth 流程、代理配置
4. **API Stats** - 公开统计查询（无需登录）
5. **User Management** - 用户管理、角色分配
6. **Settings** - Webhook 配置、系统设置
7. **Tutorial** - 使用教程
8. **User Dashboard** - 用户个人仪表板
9. **Login** - 管理员登录
10. **User Login** - 用户登录

**UI 特性**:

- ✅ 响应式设计（手机/平板/桌面）
- ✅ 暗黑模式支持
- ✅ Element Plus 组件库
- ✅ Chart.js 可视化
- ✅ Tailwind CSS
- ✅ Pinia 状态管理

### 9. 安全与认证

**认证机制**:

- ✅ API Key 认证（哈希存储）
- ✅ JWT Session（管理员）
- ✅ JWT Session（用户）
- ✅ LDAP 集成

**安全措施**:

- ✅ AES 加密（敏感数据）
- ✅ BCrypt 密码哈希
- ✅ 速率限制（rate-limiter-flexible）
- ✅ Helmet 安全头
- ✅ CORS 配置
- ✅ 输入验证

### 10. 运维与监控

**监控**:

- ✅ 健康检查端点 (`/health`)
- ✅ Metrics 端点 (`/metrics`)
- ✅ 缓存监控系统
- ✅ Winston 结构化日志
- ✅ 日志轮转（按日期）

**运维工具**:

- ✅ CLI 管理工具
- ✅ 服务管理脚本（daemon模式）
- ✅ 数据导入/导出
- ✅ 数据迁移脚本
- ✅ Docker支持
- ✅ Docker Compose (含监控栈)

**定期任务**:

- ✅ 过期 Key 清理
- ✅ 错误账户重置
- ✅ 限流状态清理
- ✅ Token 自动刷新

---

## 技术架构

### 后端技术栈

```
Node.js 20+ + TypeScript 5+
├── 框架: Fastify (比Express性能更好)
├── 数据层: ioredis + Drizzle ORM (类型安全)
├── 认证: Passport.js (统一认证策略)
├── 验证: Zod (运行时类型验证)
├── 日志: Pino (Fastify官方)
├── 测试: Vitest + Supertest
├── 代码质量: ESLint + Prettier + ts-standard
└── 文档: OpenAPI/Swagger (自动生成)
```

**为什么选 Fastify 而不是 Express?**

- 原生 TypeScript 支持
- 性能提升 2-3x（JSON Schema 验证）
- 更好的异步错误处理
- 插件系统更清晰

### 前端技术栈

```
Next.js 15 (App Router) + TypeScript
├── UI: Shadcn/ui + Tailwind CSS (保持设计语言一致性)
├── 状态管理: Zustand (比Pinia更轻量)
├── 数据获取: TanStack Query (自动缓存+重试)
├── 表单: React Hook Form + Zod
├── 图表: Recharts (React原生)
├── 工具: Day.js + lodash-es
└── 部署: Static Export (无需SSR)
```

**为什么选 Next.js App Router?**

- Server Actions 简化 API 调用
- 文件路由清晰
- 内置优化（图片、字体、Bundle）
- 可选 SSR（未来可用）

---

## 项目结构

### Monorepo 结构（推荐）

```
claude-relay-service/
├── v1/                          # 现有代码（只读，供参考）
│   ├── src/
│   ├── web/
│   └── README_V1.md
│
├── packages/                    # v2 代码
│   ├── backend/                 # 后端 (TypeScript)
│   │   ├── src/
│   │   │   ├── modules/         # 功能模块
│   │   │   │   ├── apikey/      # API Key模块
│   │   │   │   ├── account/     # 账户模块
│   │   │   │   ├── relay/       # 转发模块
│   │   │   │   ├── stats/       # 统计模块
│   │   │   │   ├── user/        # 用户模块
│   │   │   │   └── webhook/     # Webhook模块
│   │   │   ├── core/            # 核心层
│   │   │   │   ├── redis/       # Redis客户端
│   │   │   │   ├── auth/        # 认证策略
│   │   │   │   ├── scheduler/   # 统一调度器
│   │   │   │   └── logger/      # 日志系统
│   │   │   ├── shared/          # 共享工具
│   │   │   │   ├── types/       # TypeScript类型
│   │   │   │   ├── utils/       # 工具函数
│   │   │   │   └── constants/   # 常量
│   │   │   └── server.ts        # Fastify服务器
│   │   ├── tests/               # 测试
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── frontend/                # 前端 (Next.js)
│   │   ├── app/                 # App Router
│   │   │   ├── (admin)/         # 管理员路由组
│   │   │   ├── (user)/          # 用户路由组
│   │   │   ├── (public)/        # 公开路由组
│   │   │   └── api/             # API Routes (可选)
│   │   ├── components/          # 组件
│   │   │   ├── ui/              # Shadcn组件
│   │   │   ├── features/        # 功能组件
│   │   │   └── layouts/         # 布局组件
│   │   ├── lib/                 # 工具库
│   │   ├── stores/              # Zustand stores
│   │   ├── types/               # TypeScript类型
│   │   ├── package.json
│   │   └── next.config.js
│   │
│   └── shared/                  # 前后端共享
│       ├── types/               # API类型定义
│       ├── constants/           # 常量
│       └── validators/          # Zod schemas
│
├── scripts/                     # 工具脚本
│   ├── migrate-data.ts          # 数据迁移
│   └── dev.sh                   # 开发脚本
│
├── docker/
│   ├── Dockerfile.v2
│   └── docker-compose.v2.yml
│
├── package.json                 # Root package
├── pnpm-workspace.yaml          # PNPM workspace
└── turbo.json                   # Turborepo配置(可选)
```

---

## 分阶段实施计划

### 阶段 0: 准备阶段 (Week 1-2)

**目标**: 搭建基础架构，验证技术选型

**任务清单**:

- [ ] 创建 Monorepo 结构
- [ ] 配置 TypeScript + ESLint + Prettier
- [ ] 搭建 Fastify 基础服务器
- [ ] 搭建 Next.js 基础项目
- [ ] 配置 Redis 连接（复用 v1 实例）
- [ ] 实现健康检查端点
- [ ] 配置 Docker 开发环境

**验收标准**:

- ✅ `npm run dev` 启动 v2 后端 (localhost:4000)
- ✅ `npm run dev:web` 启动 v2 前端 (localhost:3000)
- ✅ `/health` 端点正常响应
- ✅ TypeScript 编译无错误

**技术风险**:

- Redis 连接共享（使用不同 key 前缀: `v2:*`）
- 端口冲突（v1:3000, v2 后端:4000, v2 前端:3001）

---

### 阶段 1: 核心基础设施 (Week 3-4)

**目标**: 实现认证、数据层、日志系统

**模块优先级**:

1. **Redis 数据层** (复用 v1 数据结构)
   - 类型安全的 Redis 客户端封装
   - 数据模型定义 (Zod schemas)
   - 加密工具类（AES）
2. **认证系统**
   - JWT 中间件
   - API Key 验证中间件
   - 用户认证中间件
3. **日志系统**
   - Pino logger 配置
   - 请求日志中间件
   - 错误追踪

**API 端点**:

```
POST /api/v2/auth/admin/login    - 管理员登录
POST /api/v2/auth/user/login     - 用户登录
POST /api/v2/auth/logout          - 登出
GET  /api/v2/auth/me              - 当前用户信息
```

**前端页面**:

- 登录页面（管理员+用户）
- 布局组件（Header + Sidebar）

**验收标准**:

- ✅ 管理员登录成功，获取 JWT Token
- ✅ 用户登录成功
- ✅ 受保护路由正常工作
- ✅ 日志正确输出到文件

---

### 阶段 2: API Key 管理 (Week 5-6)

**目标**: 完整的 API Key CRUD + 使用统计

**后端模块**:

- `modules/apikey/` - 完整 CRUD
- `modules/stats/` - 使用统计查询

**API 端点**:

```
GET    /api/v2/keys              - 列表（分页+过滤）
POST   /api/v2/keys              - 创建
GET    /api/v2/keys/:id          - 详情
PUT    /api/v2/keys/:id          - 更新
DELETE /api/v2/keys/:id          - 删除（软删除）
POST   /api/v2/keys/batch        - 批量创建
PUT    /api/v2/keys/batch        - 批量更新
GET    /api/v2/keys/:id/stats    - 使用统计
POST   /api/v2/keys/:id/restore  - 恢复
```

**前端页面**:

- API Keys 列表页（表格+分页+筛选）
- 创建 Key 弹窗
- 编辑 Key 弹窗
- 批量操作界面
- 使用统计详情

**验收标准**:

- ✅ 完整 CRUD 功能正常
- ✅ 批量操作成功
- ✅ 统计数据准确
- ✅ UI 适配暗黑模式
- ✅ 响应式设计正常

**数据迁移**:

- 编写脚本从 v1 同步 API Key 数据到 v2 (可选)

---

### 阶段 3: 账户管理 (Week 7-9)

**目标**: 实现所有账户类型的管理

**优先级顺序**:

1. Claude OAuth（最复杂，优先实现）
2. Gemini OAuth
3. OpenAI
4. 其他账户类型

**后端模块**:

- `modules/account/claude/` - Claude账户
- `modules/account/gemini/` - Gemini账户
- `modules/account/openai/` - OpenAI账户
- `modules/account/group/` - 账户分组

**API 端点**:

```
# Claude OAuth
POST   /api/v2/accounts/claude/auth-url     - 生成授权URL
POST   /api/v2/accounts/claude/exchange     - 交换code
GET    /api/v2/accounts/claude              - 列表
POST   /api/v2/accounts/claude              - 创建
PUT    /api/v2/accounts/claude/:id          - 更新
DELETE /api/v2/accounts/claude/:id          - 删除
POST   /api/v2/accounts/claude/:id/refresh  - 刷新token

# 类似的其他账户类型端点...

# 账户组
GET    /api/v2/account-groups               - 列表
POST   /api/v2/account-groups               - 创建
PUT    /api/v2/account-groups/:id           - 更新
DELETE /api/v2/account-groups/:id           - 删除
```

**前端页面**:

- 账户管理页面（多Tab切换）
- OAuth 授权流程组件
- 代理配置表单
- 账户分组管理

**验收标准**:

- ✅ OAuth 完整流程正常
- ✅ Token 自动刷新机制
- ✅ 代理配置正常工作
- ✅ 账户状态实时更新

---

### 阶段 4: API 转发核心 (Week 10-12)

**目标**: 实现核心转发功能 + 统一调度器

**后端模块**:

- `modules/relay/claude/` - Claude转发
- `modules/relay/gemini/` - Gemini转发
- `modules/relay/openai/` - OpenAI转发
- `core/scheduler/` - 统一调度器

**API 端点**:

```
POST /api/v1/messages              - Claude格式（保持兼容）
POST /gemini/v1/messages           - Gemini格式
POST /openai/v1/chat/completions   - OpenAI格式
GET  /api/v1/models                - 模型列表
GET  /api/v1/usage                 - 使用量查询
```

**关键功能**:

- ✅ 流式响应（SSE）
- ✅ Usage 数据捕获
- ✅ 智能账户选择
- ✅ Sticky Session
- ✅ 限流检测
- ✅ 错误重试
- ✅ 实时统计更新

**验收标准**:

- ✅ 使用 v2 API 成功调用 Claude
- ✅ 流式响应正常
- ✅ Usage 数据准确
- ✅ 调度器选择正确账户
- ✅ 限流自动切换账户

---

### 阶段 5: 用户系统 + Webhook (Week 13-14)

**目标**: 完整用户管理 + Webhook 通知

**后端模块**:

- `modules/user/` - 用户管理
- `modules/webhook/` - Webhook系统

**API 端点**:

```
# 用户管���
GET    /api/v2/users               - 列表
POST   /api/v2/users               - 创建
PUT    /api/v2/users/:id           - 更新
PATCH  /api/v2/users/:id/status    - 启用/禁用
GET    /api/v2/users/:id/stats     - 使用统计

# Webhook
GET    /api/v2/webhooks            - 配置列表
POST   /api/v2/webhooks            - 创建配置
PUT    /api/v2/webhooks/:id        - 更新
DELETE /api/v2/webhooks/:id        - 删除
POST   /api/v2/webhooks/test       - 测试发送
```

**前端页面**:

- 用户管理页面
- 用户仪表板
- Webhook 配置页面

**验收标准**:

- ✅ 用户 CRUD 正常
- ✅ LDAP 集成（可选）
- ✅ Webhook 通知正常发送

---

### 阶段 6: 仪表板 + 统计 (Week 15-16)

**目标**: 完整的数据可视化和统计分析

**后端模块**:

- `modules/stats/dashboard/` - 仪表板数据
- `modules/stats/analytics/` - 分析查询

**API 端点**:

```
GET /api/v2/dashboard/overview     - 系统概览
GET /api/v2/stats/usage            - 使用统计（多维度）
GET /api/v2/stats/cost             - 成本统计
GET /api/v2/stats/models           - 模型分布
GET /api/v2/stats/trends           - 趋势分析
```

**前端页面**:

- Dashboard（系统概览）
- API Stats（公开统计页）
- 使用趋势图表
- 模型分布图

**验收标准**:

- ✅ 图表数据准确
- ✅ 实时更新（可选）
- ✅ 导出功能（Excel）
- ✅ 时间范围筛选

---

### 阶段 7: 测试 + 文档 (Week 17-18)

**目标**: 完整测试覆盖 + 文档

**测试**:

- 单元测试（Vitest）- 覆盖率 >80%
- 集成测试（Supertest）- 核心API
- E2E 测试（Playwright）- 关键流程

**文档**:

- OpenAPI/Swagger 文档（自动生成）
- 部署文档
- API 使用文档
- 迁移指南

**验收标准**:

- ✅ 测试覆盖率达标
- ✅ 所有关键流程测试通过
- ✅ API 文档完整
- ✅ 部署文档清晰

---

### 阶段 8: 生产就绪 (Week 19-20)

**目标**: 优化、安全加固、生产部署

**优化**:

- 性能优化（Redis 查询、Bundle 大小）
- 内存优化
- 日志级别调整

**安全**:

- 安全审计
- 依赖漏洞扫描
- 限流调整

**部署**:

- Docker镜像构建
- CI/CD Pipeline
- 监控告警配置
- 灰度发布计划

**验收标准**:

- ✅ 性能测试达标（QPS > v1）
- ✅ 安全扫描通过
- ✅ 生产环境部署成功
- ✅ 监控正常工作

---

## 数据迁移策略

### 方案A: 双写模式（推荐）

```
v1继续运行 → 写入v1 Redis → 同步脚本 → 写入v2 Redis (key前缀v2:)
                ↓
         v2读取v2 Redis
```

**优点**:

- v1 和 v2 完全隔离
- 可以随时回滚
- 数据安全

**缺点**:

- 需要同步脚本
- Redis 存储空间翻倍

### 方案B: 共享模式（风险较高）

```
v1 和 v2 共享同一个 Redis
使用不同的key前缀区分
```

**优点**:

- 无需迁移
- 节省存储

**缺点**:

- 数据结构冲突风险
- 难以回滚

**推荐**: 使用**方案A**，安全第一

---

## 风险控制

### 技术风险

| 风险                   | 概率 | 影响 | 应对措施                         |
| ---------------------- | ---- | ---- | -------------------------------- |
| TypeScript 学习曲线    | 中   | 中   | 渐进式迁移，先迁移简单模块       |
| Redis 数据不一致       | 低   | 高   | 双写模式 + 数据校验脚本          |
| 性能下降               | 低   | 高   | 提前性能测试，QPS 基准对比       |
| OAuth 流程错误         | 中   | 高   | 优先实现 + 充分测试              |
| 前端兼容性问题         | 低   | 中   | 保持相同 UI 库（Tailwind）       |

### 项目风险

| 风险              | 概率 | 影响 | 应对措施                       |
| ----------------- | ---- | ---- | ------------------------------ |
| 时间超期          | 中   | 中   | MVP 先行，非核心功能后置       |
| v1 bug 需要修复   | 高   | 中   | 保持 v1 维护，v2 并行开发      |
| 需求变更          | 中   | 中   | 模块化设计，降低耦合           |

---

## 成功指标

### 技术指标

- ✅ QPS >= v1 的 120%
- ✅ P99 延迟 < 500ms
- ✅ 测试覆盖率 > 80%
- ✅ TypeScript 类型覆盖率 > 95%
- ✅ Bundle 大小 < 500KB (前端)

### 功能指标

- ✅ 100% 功能对等（与 v1）
- ✅ API 兼容性（v1 客户端可直接切换）
- ✅ 零数据丢失
- ✅ 停机时间 < 5 分钟（切换时）

### 开发体验指标

- ✅ TypeScript 编译时间 < 10s
- ✅ 热重载 < 2s
- ✅ 测试运行 < 30s
- ✅ 代码可读性提升（主观评估）

---

## MVP范围定义

### 如果时间紧张，以下为最小可行产品

**必须有**:

1. 管理员登录 + JWT 认证
2. API Key 管理（CRUD + 使用统计）
3. Claude OAuth 账户管理
4. `/api/v1/messages` 转发（流式+非流式）
5. 基础仪表板

**可以延后**:

- Gemini/OpenAI 等其他平台
- Webhook 通知
- 用户系统
- 批量操作
- 高级统计

---

## 总结与建议

### 核心原则

1. **别搞大爆炸式重写** - 增量迁移，先MVP，再扩展
2. **别过度工程化** - TypeScript 已经够了，别加 GraphQL、微服务
3. **复用数据结构** - v1 的 Redis 设计很好，直接用 TypeScript 包装
4. **保持简单** - Fastify + Next.js 就够了，别搞复杂架构

### 时间估算

**预计总时长**: 5-6 个月（全职 1 人）或 3-4 个月（2 人团队）

**阶段划分**:

1. **前2个月**: 完成 MVP（阶段0-2），验证架构可行性
2. **第3-4个月**: 完成核心转发（阶段3-4），确保功能对等
3. **第5-6个月**: 补充完整功能（阶段5-8），优化和测试

---

**文档版本**: v1.0
**最后更新**: 2025-10-04
**维护者**: Claude Code Team
