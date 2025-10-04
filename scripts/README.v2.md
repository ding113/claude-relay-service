# v2 Development Scripts

开发辅助脚本集合

## 🚀 dev-v2.sh - 开发环境启动

快速启动 v2 开发环境的脚本

### 用法

```bash
# 同时启动前后端（默认）
./scripts/dev-v2.sh

# 只启动 Backend
./scripts/dev-v2.sh backend

# 只启动 Frontend
./scripts/dev-v2.sh frontend

# 显示帮助
./scripts/dev-v2.sh help
```

### 功能

- ✅ 自动检查 pnpm 安装
- ✅ 自动安装依赖
- ✅ 自动创建 .env 文件
- ✅ 支持前后端分别启动或同时启动
- ✅ Ctrl+C 优雅停止所有服务

### 端口分配

- Backend: `http://localhost:4000`
- Frontend: `http://localhost:3001`
- Health Check: `http://localhost:4000/health`

## 📝 其他脚本

可根据需要添加更多脚本：

- `build-v2.sh` - 构建脚本
- `test-v2.sh` - 测试脚本
- `deploy-v2.sh` - 部署脚本
- `migrate-v2.sh` - 数据迁移脚本
