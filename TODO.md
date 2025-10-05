# Claude Relay Service v2 开发待办事项

**最后更新**: 2025-10-05
**当前阶段**: Phase 5 - 统一调度器

---

## 🎯 近期目标

### Phase 5: 统一调度器（当前）

#### 1. 调度器核心逻辑
- [ ] 创建 `backend/src/core/scheduler/index.ts`
  - [ ] 账户筛选（平台、模型、状态匹配）
  - [ ] 优先级排序
  - [ ] Sticky Session 支持（基于会话 Hash）
  - [ ] 负载均衡（相同优先级轮询）

#### 2. 即时重试机制
- [ ] 错误检测（429、500、529、网络错误）
- [ ] 自动切换账户（无需阈值，立即重试）
- [ ] 用户无感（透明重试）
- [ ] 最大重试次数限制

#### 3. 会话映射管理
- [ ] 创建/更新会话映射（15 天 TTL）
- [ ] 智能续期（14 天阈值）
- [ ] 会话清理（过期自动删除）

#### 4. 单元测试
- [ ] 创建 `backend/tests/core/scheduler/index.test.ts`
  - [ ] 账户筛选测试
  - [ ] Sticky Session 测试
  - [ ] 负载均衡测试
  - [ ] 重试机制测试

---

## 📋 中期目标

### Phase 5: 统一调度器（核心）
- [ ] 创建 `backend/src/core/scheduler/index.ts`
  - [ ] 账户筛选逻辑（平台、模型、状态）
  - [ ] 优先级排序
  - [ ] Sticky Session 支持
  - [ ] 负载均衡（相同优先级轮询）
- [ ] 即时重试机制
  - [ ] 错误检测（429、500、529、网络错误）
  - [ ] 自动切换账户
  - [ ] 重试次数限制
- [ ] 会话映射管理
  - [ ] 基于 conversation_id 的 Hash
  - [ ] 自动续期（14 天阈值）
- [ ] 单元测试
  - [ ] `backend/tests/core/scheduler/index.test.ts`

### Phase 6: API 转发核心
- [ ] 创建 `backend/src/modules/relay/service.ts`
  - [ ] HTTP 客户端封装（undici）
  - [ ] 代理支持（HTTP/SOCKS5）
  - [ ] 超时控制
- [ ] 创建 `backend/src/modules/relay/route.ts`
  - [ ] `POST /api/v1/messages` - Claude Messages API（v1 兼容）
  - [ ] `GET /api/v1/models` - 模型列表
- [ ] 流式响应处理
  - [ ] SSE (Server-Sent Events)
  - [ ] Usage 数据捕获
  - [ ] 错误处理 + 重试
- [ ] 集成测试
  - [ ] Mock Claude API 测试
  - [ ] 流式/非流式测试

### Phase 7: 统计查询模块
- [ ] 创建 `backend/src/modules/stats/service.ts`
  - [ ] 按 Key 查询统计
  - [ ] 按日期范围查询
  - [ ] 按模型聚合
  - [ ] 成本统计
- [ ] 创建 `backend/src/modules/stats/route.ts`
  - [ ] `GET /api/v2/stats/keys/:id` - Key 统计
  - [ ] `GET /api/v2/stats/usage` - 使用统计
  - [ ] `GET /api/v2/stats/cost` - 成本统计
- [ ] 单元测试

---

## 🎨 前端开发

### Phase 8: 前端界面（Next.js 15）
- [x] 初始化 Next.js 15 项目（App Router）
- [ ] 登录页面
  - [ ] 管理员登录表单
  - [ ] JWT Token 存储
- [ ] API Key 管理页面
  - [ ] Key 列表（表格）
  - [ ] 创建 Key 对话框
  - [ ] 编辑/删除/恢复操作
  - [ ] 使用统计图表
- [ ] 账户管理页面
  - [ ] Claude Console 账户列表
  - [ ] Codex 账户列表
  - [ ] 创建/编辑/删除操作
  - [ ] 测试连接按钮
- [ ] 统计仪表板
  - [ ] 总览卡片（请求数、Token、成本）
  - [ ] 趋势图表（按日/月）
  - [ ] 模型使用分布
- [ ] 布局与导航
  - [ ] 侧边栏导航
  - [ ] 用户信息/登出

---

## 🚀 生产就绪

### Phase 9: 部署与优化
- [ ] Docker 配置
  - [ ] 更新 `docker/Dockerfile`
  - [ ] 更新 `docker-compose.yml`
  - [ ] 多阶段构建优化
- [ ] CI/CD
  - [ ] GitHub Actions workflow
  - [ ] 自动测试
  - [ ] 自动构建镜像
- [ ] 性能测试
  - [ ] QPS 基准测试
  - [ ] 并发测试
  - [ ] 内存泄漏检测
- [ ] 安全审计
  - [ ] 依赖漏洞扫描
  - [ ] 敏感数据加密检查
- [ ] 文档
  - [ ] 部署文档
  - [ ] API 使用文档
  - [ ] 故障排查指南

---

## ✅ 已完成

### Phase 1: 数据层（2025-10-04）
- [x] TypeScript 项目配置
- [x] Fastify 服务器搭建
- [x] Pino 日志系统
- [x] Redis 客户端封装
- [x] 6 个 Repository（ApiKey, Account, Admin, Session, Usage, Index）
- [x] 加密/时区/密码工具
- [x] 198 个单元测试（全部通过）

### Phase 2: 认证与管理员登录（2025-10-04）
- [x] JWT 插件（@fastify/jwt）
- [x] AdminRepository
- [x] AuthService
- [x] 3 个 Auth API 端点
- [x] 密码哈希（Argon2）

### Phase 3: API Key 管理（2025-10-05）
- [x] ApiKeyService
- [x] 7 个 API Key 端点
- [x] 完整 CRUD + 软删除/恢复
- [x] 使用统计集成
- [x] Swagger 文档
- [x] 36 个 Service 单元测试

### Phase 4: 账户管理（2025-10-05）
- [x] AccountService（500+ 行）
- [x] 8 个 Account API 端点
- [x] 完整 CRUD + 状态管理
- [x] 账户可用性检查（checkAvailability）
- [x] 代理配置验证
- [x] 模型映射支持（对象/数组格式）
- [x] Swagger 文档
- [x] 53 个 Service 单元测试

---

## 📝 备注

- 当前使用 pnpm workspace monorepo 结构
- 所有 API 端点需要 Swagger 文档
- 所有 Service 需要单元测试（覆盖率 > 80%）
- 遵循 Linus 八荣八耻原则
- 代码风格：无 emoji，标准专业日志
