#!/bin/bash

# Claude Relay Service v2 - 开发环境启动脚本
# 用法: ./scripts/dev-v2.sh [backend|frontend|all]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
V2_DIR="$PROJECT_ROOT/v2"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# 检查 pnpm 是否安装
check_pnpm() {
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装，请先安装 pnpm"
        log_info "安装命令: npm install -g pnpm"
        exit 1
    fi
    log_success "pnpm 已安装: $(pnpm -v)"
}

# 检查依赖是否安装
check_dependencies() {
    log_info "检查依赖..."

    if [ ! -d "$V2_DIR/node_modules" ]; then
        log_warning "v2 依赖未安装，正在安装..."
        cd "$V2_DIR" && pnpm install
    fi

    if [ ! -d "$V2_DIR/backend/node_modules" ]; then
        log_warning "Backend 依赖未安装，正在安装..."
        cd "$V2_DIR/backend" && pnpm install
    fi

    if [ ! -d "$V2_DIR/frontend/node_modules" ]; then
        log_warning "Frontend 依赖未安装，正在安装..."
        cd "$V2_DIR/frontend" && pnpm install
    fi

    log_success "依赖检查完成"
}

# 检查环境变量
check_env() {
    log_info "检查环境变量..."

    if [ ! -f "$V2_DIR/backend/.env" ]; then
        log_warning "Backend .env 文件不存在，从示例创建..."
        cp "$V2_DIR/backend/.env.example" "$V2_DIR/backend/.env"
        log_warning "请编辑 v2/backend/.env 文件配置必要的环境变量"
    fi

    if [ ! -f "$V2_DIR/frontend/.env.local" ]; then
        log_warning "Frontend .env.local 文件不存在，从示例创建..."
        cp "$V2_DIR/frontend/.env.example" "$V2_DIR/frontend/.env.local"
    fi

    log_success "环境变量检查完成"
}

# 启动 Backend
start_backend() {
    log_info "启动 v2 Backend (端口 4000)..."
    cd "$V2_DIR/backend"
    pnpm dev
}

# 启动 Frontend
start_frontend() {
    log_info "启动 v2 Frontend (端口 3001)..."
    cd "$V2_DIR/frontend"
    pnpm dev
}

# 同时启动前后端
start_all() {
    log_info "同时启动 v2 Backend 和 Frontend..."

    # 使用 trap 捕获退出信号
    trap 'kill 0' SIGINT SIGTERM EXIT

    # 后台启动 Backend
    (
        cd "$V2_DIR/backend"
        pnpm dev
    ) &
    BACKEND_PID=$!

    # 等待 Backend 启动
    sleep 3

    # 后台启动 Frontend
    (
        cd "$V2_DIR/frontend"
        pnpm dev
    ) &
    FRONTEND_PID=$!

    log_success "Backend PID: $BACKEND_PID"
    log_success "Frontend PID: $FRONTEND_PID"

    log_info "================================"
    log_info "v2 开发环境已启动:"
    log_info "🚀 Backend:  http://localhost:4000"
    log_info "🎨 Frontend: http://localhost:3001"
    log_info "🏥 Health:   http://localhost:4000/health"
    log_info "================================"
    log_warning "按 Ctrl+C 停止服务"

    # 等待子进程
    wait
}

# 显示帮助
show_help() {
    echo "Claude Relay Service v2 - 开发环境启动脚本"
    echo ""
    echo "用法: $0 [OPTION]"
    echo ""
    echo "选项:"
    echo "  backend     只启动 Backend (端口 4000)"
    echo "  frontend    只启动 Frontend (端口 3001)"
    echo "  all         同时启动前后端 (默认)"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0              # 启动前后端"
    echo "  $0 backend      # 只启动后端"
    echo "  $0 frontend     # 只启动前端"
}

# 主函数
main() {
    echo ""
    log_info "Claude Relay Service v2 - 开发环境"
    echo ""

    check_pnpm
    check_dependencies
    check_env

    echo ""

    MODE="${1:-all}"

    case "$MODE" in
        backend)
            start_backend
            ;;
        frontend)
            start_frontend
            ;;
        all)
            start_all
            ;;
        help)
            show_help
            ;;
        *)
            log_error "未知选项: $MODE"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
