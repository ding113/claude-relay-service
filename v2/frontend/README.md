# Claude Relay Service v2 - Frontend

基于 Next.js 15 + TypeScript 的现代化 Web 管理界面

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .env.local
```

### 开发模式

```bash
pnpm dev
```

访问 `http://localhost:3001`

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
app/
├── (admin)/           # 管理员路由组
├── (user)/            # 用户路由组
├── (public)/          # 公开路由组
├── globals.css        # 全局样式
├── layout.tsx         # Root布局
└── page.tsx           # 首页

components/
├── ui/                # Shadcn/ui 组件
├── features/          # 功能组件
└── layouts/           # 布局组件

lib/
├── api.ts             # API 客户端
└── utils.ts           # 工具函数

stores/
└── auth.ts            # Zustand stores
```

## 🔧 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript 5.x
- **UI 库**: Shadcn/ui + Radix UI
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **数据获取**: TanStack Query
- **表单**: React Hook Form + Zod
- **图表**: Recharts

## 🎨 特性

- ✅ **响应式设计** - 完美适配手机/平板/桌面
- ✅ **暗黑模式** - 完整的明亮/暗黑模式支持
- ✅ **TypeScript** - 完整类型安全
- ✅ **组件化** - 基于 Shadcn/ui 的可复用组件
- ✅ **API 集成** - TanStack Query 自动缓存和重试

## 🌐 环境变量

| 变量                      | 默认值                  | 说明            |
| ------------------------- | ----------------------- | --------------- |
| `NEXT_PUBLIC_API_URL`     | http://localhost:4000   | 后端 API 地址   |

## 📝 开发规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Next.js 规则
- 使用 Prettier 格式化代码
- 组件使用函数组件 + Hooks

## 🎯 路由规划

- `/` - 首页
- `/login` - 管理员登录
- `/dashboard` - 仪表板
- `/api-keys` - API Key 管理
- `/accounts` - 账户管理
- `/user/login` - 用户登录
- `/user/dashboard` - 用户仪表板

## 🚧 开发中

当前版本是基础骨架，正在开发中的功能：

- [ ] 登录/认证页面
- [ ] API Key 管理
- [ ] 账户管理
- [ ] 仪表板
- [ ] 用户系统
