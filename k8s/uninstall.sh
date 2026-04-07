#!/bin/bash
#
# Koduck APISIX 卸载脚本
# 使用方法: 
#   从项目根目录: ./k8s/uninstall.sh [dev|prod|all]
#   从 k8s 目录:  ./uninstall.sh [dev|prod|all]
#

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV="${1:-dev}"

# 验证环境
if [[ ! "$ENV" =~ ^(dev|prod|all)$ ]]; then
    echo -e "${RED}错误: 环境必须是 dev, prod 或 all${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Koduck APISIX 卸载工具${NC}"
echo -e "${BLUE}  目标: ${ENV}${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}错误: kubectl 未安装${NC}"
    exit 1
fi

# 卸载指定环境
uninstall_env() {
    local env=$1
    local namespace="koduck-${env}"
    
    echo -e "\n${YELLOW}卸载 ${env} 环境...${NC}"
    
    # 删除资源
    if command -v kustomize &> /dev/null; then
        kustomize build "${SCRIPT_DIR}/overlays/${env}" 2>/dev/null | kubectl delete -f - --ignore-not-found=true
    else
        kubectl delete -k "${SCRIPT_DIR}/overlays/${env}" --ignore-not-found=true 2>/dev/null || true
    fi
    
    # 删除 PVC
    echo -e "${YELLOW}删除 PVC...${NC}"
    kubectl delete pvc -n "${namespace}" --ignore-not-found=true --all
    
    # 删除命名空间
    read -p "是否删除命名空间 ${namespace}? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}删除命名空间 ${namespace}...${NC}"
        kubectl delete namespace "${namespace}" --ignore-not-found=true
    fi
    
    echo -e "${GREEN}✓ ${env} 环境已卸载${NC}"
}

# 卸载所有环境
uninstall_all() {
    echo -e "${RED}警告: 这将卸载所有环境!${NC}"
    read -p "确认继续? (yes/no) " -r
    
    if [[ $REPLY == "yes" ]]; then
        uninstall_env "dev"
        uninstall_env "prod"
        echo -e "\n${GREEN}✓ 所有环境已卸载${NC}"
    else
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
}

# 主流程
case $ENV in
    dev|prod)
        uninstall_env "$ENV"
        ;;
    all)
        uninstall_all
        ;;
esac

echo -e "\n${GREEN}卸载完成!${NC}"
