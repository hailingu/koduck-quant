#!/bin/bash
# 本地性能测试快速启动脚本

set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"
TEST_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              Koduck Backend 本地性能测试                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "目标服务: $BASE_URL"
echo ""

# 检查 K6 安装
if ! command -v k6 &> /dev/null; then
    echo "❌ K6 未安装"
    echo "安装方式:"
    echo "  macOS: brew install k6"
    echo "  Linux: sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69"
    echo "         echo \"deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main\" | sudo tee /etc/apt/sources.list.d/k6.list"
    echo "         sudo apt-get update && sudo apt-get install k6"
    exit 1
fi

echo "✅ K6 已安装: $(k6 version | head -1)"
echo ""

# 检查服务可用性
echo "🔍 检查目标服务..."
if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
    echo "✅ 服务可用"
else
    echo "⚠️  服务未响应，请确保服务已启动:"
    echo "  cd koduck-backend && mvn spring-boot:run"
    exit 1
fi
echo ""

# 菜单
PS3='请选择测试场景: '
options=(
    "Health API 压力测试 (高RPS)"
    "行情数据 API 测试 (缓存场景)"
    "用户资料 API 测试 (数据库场景)"
    "混合负载测试 (全场景)"
    "退出"
)

select opt in "${options[@]}"; do
    case $REPLY in
        1)
            echo ""
            echo "🚀 运行 Health API 压力测试..."
            k6 run --env BASE_URL="$BASE_URL" "$TEST_DIR/health-api-test.js"
            break
            ;;
        2)
            echo ""
            echo "🚀 运行行情数据 API 测试..."
            k6 run --env BASE_URL="$BASE_URL" "$TEST_DIR/market-quote-test.js"
            break
            ;;
        3)
            echo ""
            echo "🚀 运行用户资料 API 测试..."
            k6 run --env BASE_URL="$BASE_URL" "$TEST_DIR/user-profile-test.js"
            break
            ;;
        4)
            echo ""
            echo "🚀 运行混合负载测试..."
            k6 run --env BASE_URL="$BASE_URL" "$TEST_DIR/mixed-load-test.js"
            break
            ;;
        5)
            echo "退出"
            exit 0
            ;;
        *)
            echo "无效选项"
            ;;
    esac
done
