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
    local pvs=""
    local max_wait_seconds=30
    local pod_wait_seconds=20
    
    echo -e "\n${YELLOW}卸载 ${env} 环境...${NC}"
    echo -e "${YELLOW}说明: 将删除命名空间内 Secret（含 ${env}-koduck-auth-jwt-keys），下次 install 会自动生成新 RSA key${NC}"

    if ! kubectl get namespace "${namespace}" >/dev/null 2>&1; then
        echo -e "${YELLOW}命名空间 ${namespace} 不存在，跳过${NC}"
        return 0
    fi

    # 先记录该命名空间下关联的 PV（cluster 级资源）
    pvs=$(kubectl get pv --no-headers 2>/dev/null | awk -v ns="${namespace}" '$6 ~ "^"ns"/" {print $1}' || true)
    
    # 先删除 Pod（避免 PVC 被占用）
    echo -e "${YELLOW}删除 Pod...${NC}"
    kubectl delete pod -n "${namespace}" --all --force --grace-period=0 --wait=false 2>/dev/null || true
    kubectl get pod -n "${namespace}" -o name 2>/dev/null | while read pod; do
        [ -z "${pod}" ] && continue
        kubectl patch "${pod}" -n "${namespace}" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
    done
    
    # 删除 PVC（强制删除，清除 finalizers）
    echo -e "${YELLOW}删除 PVC...${NC}"
    kubectl get pvc -n "${namespace}" -o name 2>/dev/null | while read pvc; do
        [ -z "${pvc}" ] && continue
        kubectl patch "${pvc}" -n "${namespace}" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
        kubectl delete "${pvc}" -n "${namespace}" --force --grace-period=0 --wait=false 2>/dev/null || true
    done
    
    # 删除其他资源
    echo -e "${YELLOW}删除其他资源...${NC}"
    kubectl delete job -n "${namespace}" --all --ignore-not-found=true --wait=false 2>/dev/null || true
    kubectl delete deployment,statefulset,service,configmap,secret -n "${namespace}" --ignore-not-found=true --all --wait=false 2>/dev/null || true

    # 清理 PV（防止 PVC 删除后 PV 卡住）
    if [ -n "${pvs}" ]; then
        echo -e "${YELLOW}删除关联 PV...${NC}"
        echo "${pvs}" | while read pv; do
            [ -z "${pv}" ] && continue
            kubectl patch pv "${pv}" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
            kubectl delete pv "${pv}" --force --grace-period=0 --wait=false 2>/dev/null || true
        done
    fi
    
    # 删除命名空间
    echo -e "${YELLOW}删除命名空间 ${namespace}...${NC}"
    kubectl delete namespace "${namespace}" --ignore-not-found=true --force --grace-period=0 --wait=false 2>/dev/null || true
    
    # 如果命名空间卡住，清除 finalizers
    if command -v jq &> /dev/null; then
        for _ in {1..10}; do
            if ! kubectl get namespace "${namespace}" >/dev/null 2>&1; then
                break
            fi
            kubectl get namespace "${namespace}" -o json 2>/dev/null | \
                jq '.spec.finalizers = []' 2>/dev/null | \
                kubectl replace --raw "/api/v1/namespaces/${namespace}/finalize" -f - 2>/dev/null || true
            sleep 1
        done
    fi

    # 等待命名空间真正消失，避免“显示成功但仍有 Terminating 资源”
    for ((i=1; i<=max_wait_seconds; i++)); do
        if ! kubectl get namespace "${namespace}" >/dev/null 2>&1; then
            break
        fi
        if command -v jq &> /dev/null; then
            kubectl get namespace "${namespace}" -o json 2>/dev/null | \
                jq '.spec.finalizers = []' 2>/dev/null | \
                kubectl replace --raw "/api/v1/namespaces/${namespace}/finalize" -f - 2>/dev/null || true
        fi
        sleep 1
    done

    # 最终确认
    if kubectl get namespace "${namespace}" >/dev/null 2>&1; then
        echo -e "${RED}✗ ${namespace} 仍存在（可能仍在 Terminating）${NC}"
        echo -e "${YELLOW}请重试卸载，或手动 finalize 该 namespace${NC}"
        return 1
    fi

    # 某些情况下 namespace 删除后，kubectl get pods -A 仍短暂出现“幽灵 Terminating Pod”。
    # 这里做一次兜底清理与等待，避免误报成功。
    for ((i=1; i<=pod_wait_seconds; i++)); do
        local leaked_pods
        leaked_pods=$(kubectl get pods -A --no-headers 2>/dev/null | awk -v ns="${namespace}" '$1 == ns {print $2}' || true)
        if [ -z "${leaked_pods}" ]; then
            break
        fi

        echo "${leaked_pods}" | while read pod; do
            [ -z "${pod}" ] && continue
            kubectl -n "${namespace}" delete pod "${pod}" --force --grace-period=0 --wait=false 2>/dev/null || true
            kubectl delete --raw "/api/v1/namespaces/${namespace}/pods/${pod}" 2>/dev/null || true
        done
        sleep 1
    done

    local leaked_after
    leaked_after=$(kubectl get pods -A --no-headers 2>/dev/null | awk -v ns="${namespace}" '$1 == ns {print $2}' || true)
    if [ -n "${leaked_after}" ]; then
        echo -e "${RED}✗ ${namespace} 仍有残留 Pod（API 可能存在短暂不一致）${NC}"
        echo -e "${YELLOW}残留 Pod:${NC}"
        echo "${leaked_after}" | sed 's/^/  - /'
        echo -e "${YELLOW}建议等待 10~30 秒后重试；若仍存在，重启本地 Kubernetes 控制面（Docker Desktop Kubernetes）${NC}"
        return 1
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
