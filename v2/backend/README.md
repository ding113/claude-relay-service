# Claude Relay Service v2 - Backend

基于 Fastify + TypeScript 的高性能 API 服务

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的配置
```

### 开发模式

```bash
pnpm dev
```

服务将在 `http://localhost:4000` 启动

### 构建

```bash
pnpm build
```

### 生产运行

```bash
pnpm start
```

## 📁 项目结构

```
src/
├── core/              # 核心层
│   ├── config.ts      # 配置管理
│   ├── logger/        # 日志系统（Pino）
│   └── redis/         # Redis 客户端
├── modules/           # 功能模块
│   └── health/        # 健康检查
├── shared/            # 共享工具
│   ├── types/         # TypeScript 类型
│   └── utils/         # 工具函数
└── server.ts          # 服务器入口
```

## 🔧 技术栈

- **框架**: Fastify 5.x
- **语言**: TypeScript 5.x
- **验证**: Zod
- **日志**: Pino
- **数据库**: Redis (ioredis)
- **测试**: Vitest

## 🌐 API 端点

### 健康检查

```
GET /health
```

**响应示例**:

```json
{
  "status": "healthy",
  "service": "claude-relay-service-v2",
  "version": "2.0.0",
  "timestamp": "2025-10-04T10:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "components": {
    "redis": {
      "status": "healthy",
      "connected": true,
      "db": 1
    }
  }
}
```

## 🗄️ Redis 配置

v2 Backend 使用 Redis **DB 1**（v1 使用 DB 0），确保数据完全隔离。

## 🔒 环境变量

| 变量                | 必填 | 默认值      | 说明                        |
| ------------------- | ---- | ----------- | --------------------------- |
| `NODE_ENV`          | -    | development | 运行环境                    |
| `PORT`              | -    | 4000        | 服务端口                    |
| `HOST`              | -    | 0.0.0.0     | 绑定地址                    |
| `JWT_SECRET`        | ✅   | -           | JWT 密钥（至少 32 字符）    |
| `ENCRYPTION_KEY`    | ✅   | -           | 加密密钥（必须 32 字符）    |
| `REDIS_HOST`        | -    | localhost   | Redis 主机                  |
| `REDIS_PORT`        | -    | 6379        | Redis 端口                  |
| `REDIS_DB`          | -    | 1           | Redis 数据库编号（v2 用 1） |
| `LOG_LEVEL`         | -    | info        | 日志级别                    |

## 📝 开发规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 编写单元测试（Vitest）

## 🧪 测试

```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch
```

## 🐛 调试

开发模式下，日志会使用 Pino-pretty 进行美化输出。

生产环境下，日志输出为 JSON 格式，便于日志收集。
