#!/bin/bash
#
# Koduck APISIX 部署脚本
# 使用方法: 
#   从项目根目录: ./k8s/deploy.sh [dev|prod] [install|status|port-forward|logs]
#   从 k8s 目录:  ./deploy.sh [dev|prod] [install|status|port-forward|logs]
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

# 参数
ENV="${1:-dev}"
ACTION="${2:-install}"

# 验证环境
if [[ ! "$ENV" =~ ^(dev|prod)$ ]]; then
    echo -e "${RED}错误: 环境必须是 dev 或 prod${NC}"
    exit 1
fi

# 验证操作
if [[ ! "$ACTION" =~ ^(install|status|port-forward|logs)$ ]]; then
    echo -e "${RED}错误: 操作必须是 install, status, port-forward 或 logs${NC}"
    exit 1
fi

NAMESPACE="koduck-${ENV}"

# 加载环境变量文件
ENV_FILE="${SCRIPT_DIR}/.env.${ENV}"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
    echo -e "${GREEN}✓ 已加载 ${ENV_FILE}${NC}"
else
    echo -e "${RED}错误: 环境变量文件不存在: ${ENV_FILE}${NC}"
    echo -e "${YELLOW}请从模板创建: cp ${SCRIPT_DIR}/.env.template ${ENV_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Koduck APISIX 部署工具${NC}"
echo -e "${BLUE}  环境: ${ENV}${NC}"
echo -e "${BLUE}  命名空间: ${NAMESPACE}${NC}"
echo -e "${BLUE}  操作: ${ACTION}${NC}"
echo -e "${BLUE}========================================${NC}"

# 检查 kubectl
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}错误: kubectl 未安装${NC}"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}错误: 无法连接到 Kubernetes 集群${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Kubernetes 集群连接正常${NC}"
}

# 确保 etcd PVC 可用（避免 PVC Terminating 导致 etcd Pending）
ensure_etcd_pvc_ready() {
    local pvc_name="${ENV}-apisix-etcd-data"
    local storage_size="1Gi"
    local storage_class="hostpath"

    if [ "${ENV}" = "prod" ]; then
        storage_size="10Gi"
    fi

    # 如果 PVC 正在删除，先清理掉
    if kubectl -n "${NAMESPACE}" get pvc "${pvc_name}" >/dev/null 2>&1; then
        local deleting
        deleting=$(kubectl -n "${NAMESPACE}" get pvc "${pvc_name}" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null || echo "")
        if [ -n "${deleting}" ]; then
            echo -e "${YELLOW}检测到 PVC ${pvc_name} 正在删除，执行清理...${NC}"
            kubectl -n "${NAMESPACE}" patch pvc "${pvc_name}" -p '{"metadata":{"finalizers":[]}}' --type=merge 2>/dev/null || true
            kubectl -n "${NAMESPACE}" delete pvc "${pvc_name}" --force --grace-period=0 --wait=false 2>/dev/null || true
            sleep 2
        fi
    fi

    # 若 PVC 不存在，主动创建
    if ! kubectl -n "${NAMESPACE}" get pvc "${pvc_name}" >/dev/null 2>&1; then
        echo -e "${YELLOW}创建 PVC ${pvc_name}...${NC}"
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ${pvc_name}
  namespace: ${NAMESPACE}
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: ${storage_size}
  storageClassName: ${storage_class}
EOF
    fi

    # 等待 PVC 进入可调度状态（Bound 最佳，Pending 可继续等待调度）
    for i in $(seq 1 30); do
        local phase
        phase=$(kubectl -n "${NAMESPACE}" get pvc "${pvc_name}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
        if [ "${phase}" = "Bound" ] || [ "${phase}" = "Pending" ]; then
            return 0
        fi
        sleep 1
    done

    echo -e "${RED}错误: PVC ${pvc_name} 未进入可用状态${NC}"
    kubectl -n "${NAMESPACE}" get pvc "${pvc_name}" -o wide || true
    exit 1
}

# 等待指定 label 的 Pod Ready，失败时输出诊断
wait_pods_ready() {
    local label_selector="$1"
    local timeout="$2"
    local name_hint="$3"

    if ! kubectl wait --for=condition=ready pod -l "${label_selector}" -n "${NAMESPACE}" --timeout="${timeout}"; then
        echo -e "${RED}错误: ${name_hint} 未在 ${timeout} 内就绪${NC}"
        kubectl -n "${NAMESPACE}" get pod -l "${label_selector}" -o wide || true
        kubectl -n "${NAMESPACE}" describe pod -l "${label_selector}" | sed -n '1,220p' || true
        exit 1
    fi
}

# 确保命名空间可用（避免卸载后 Terminating 导致安装失败）
ensure_namespace_ready() {
    local max_wait_seconds=45
    local phase=""

    if kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        phase=$(kubectl get namespace "${NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
        if [ "${phase}" = "Terminating" ]; then
            echo -e "${YELLOW}命名空间 ${NAMESPACE} 正在 Terminating，等待清理...${NC}"
            for ((i=1; i<=max_wait_seconds; i++)); do
                if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
                    break
                fi

                if command -v jq &> /dev/null; then
                    kubectl get namespace "${NAMESPACE}" -o json 2>/dev/null | \
                        jq '.spec.finalizers = []' 2>/dev/null | \
                        kubectl replace --raw "/api/v1/namespaces/${NAMESPACE}/finalize" -f - 2>/dev/null || true
                fi
                sleep 1
            done
        fi
    fi

    if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        kubectl create namespace "${NAMESPACE}" >/dev/null
    fi

    for ((i=1; i<=max_wait_seconds; i++)); do
        phase=$(kubectl get namespace "${NAMESPACE}" -o jsonpath='{.status.phase}' 2>/dev/null || echo "")
        if [ "${phase}" = "Active" ]; then
            return 0
        fi
        sleep 1
    done

    echo -e "${RED}错误: 命名空间 ${NAMESPACE} 未能在 ${max_wait_seconds}s 内进入 Active 状态${NC}"
    exit 1
}

# 安装
install() {
    echo -e "${YELLOW}部署 APISIX (${ENV} 环境)...${NC}"

    ensure_namespace_ready

    # 检查必要的环境变量
    if [ -z "$JWT_SECRET" ]; then
        echo -e "${RED}错误: JWT_SECRET 未设置，请在 ${ENV_FILE} 中配置${NC}"
        exit 1
    fi

    # 创建 JWT Secret（动态注入，不在 YAML 中硬编码）
    kubectl create secret generic jwt-secret \
        --from-literal=jwt-secret="$JWT_SECRET" \
        -n "${NAMESPACE}" \
        --dry-run=client -o yaml | kubectl apply -f -

    ensure_etcd_pvc_ready

    # 清理已完成的旧 init Job，确保重新注册路由
    kubectl delete job "${ENV}-apisix-route-init" -n "${NAMESPACE}" --ignore-not-found=true --wait=false 2>/dev/null || true

    # 阶段一：部署基础设施（etcd + APISIX + Frontend）
    echo -e "${YELLOW}部署基础设施...${NC}"
    if command -v kustomize &> /dev/null; then
        kustomize build --load-restrictor=LoadRestrictionsNone "${SCRIPT_DIR}/overlays/${ENV}" | kubectl apply -f -
    else
        kubectl kustomize --load-restrictor=LoadRestrictionsNone "${SCRIPT_DIR}/overlays/${ENV}" | kubectl apply -f -
    fi

    echo -e "${YELLOW}等待 etcd 启动...${NC}"
    wait_pods_ready "app=apisix-etcd" "180s" "etcd"

    echo -e "${YELLOW}等待 APISIX 启动...${NC}"
    wait_pods_ready "app=apisix-gateway" "180s" "APISIX gateway"

    echo -e "${YELLOW}等待 Frontend 启动...${NC}"
    wait_pods_ready "app=koduck-frontend" "180s" "frontend"

    # 阶段二：APISIX 就绪后注册路由和 Consumer
    echo -e "${YELLOW}注册路由和 Consumer...${NC}"
    kubectl apply -f "${SCRIPT_DIR}/overlays/${ENV}/apisix-route-init.yaml"
    if ! kubectl wait --for=condition=complete job/"${ENV}-apisix-route-init" -n "${NAMESPACE}" --timeout=180s; then
        echo -e "${RED}错误: 路由初始化 Job 执行失败${NC}"
        kubectl -n "${NAMESPACE}" get job "${ENV}-apisix-route-init" -o wide || true
        kubectl -n "${NAMESPACE}" logs job/"${ENV}-apisix-route-init" || true
        exit 1
    fi

    echo -e "${GREEN}✓ Koduck 部署完成${NC}"
    show_access_info
}

# 查看状态
status() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  APISIX 状态 (${ENV})${NC}"
    echo -e "${BLUE}========================================${NC}"
    
    echo -e "\n${YELLOW}Pods:${NC}"
    kubectl get pods -n "${NAMESPACE}" -o wide
    
    echo -e "\n${YELLOW}Services:${NC}"
    kubectl get svc -n "${NAMESPACE}"
    
    echo -e "\n${YELLOW}Deployments:${NC}"
    kubectl get deployment -n "${NAMESPACE}"
    
    if [ "$ENV" == "prod" ]; then
        echo -e "\n${YELLOW}PVC:${NC}"
        kubectl get pvc -n "${NAMESPACE}"
    fi
}

# 端口转发
port_forward() {
    echo -e "${YELLOW}启动端口转发 (${ENV})...${NC}"
    echo -e "${BLUE}Gateway: http://localhost:9080${NC}"
    echo -e "${YELLOW}按 Ctrl+C 停止${NC}\n"
    
    kubectl port-forward svc/dev-apisix-gateway 9080:9080 -n "${NAMESPACE}" 2>/dev/null || \
    kubectl port-forward svc/prod-apisix-gateway 9080:9080 -n "${NAMESPACE}"
}

# 查看日志
logs() {
    local pod
    pod=$(kubectl get pods -n "${NAMESPACE}" -l app=apisix-gateway -o jsonpath='{.items[0].metadata.name}')
    kubectl logs -f "${pod}" -n "${NAMESPACE}"
}

# 访问信息
show_access_info() {
    echo -e "\n${GREEN}========================================${NC}"
    echo -e "${GREEN}  访问方式${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # NodePort
    local node_port
    node_port=$(kubectl get svc -n "${NAMESPACE}" -o jsonpath='{.items[0].spec.ports[0].nodePort}' 2>/dev/null || echo "")
    
    if [ -n "$node_port" ]; then
        local node_ip
        node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[0].address}')
        echo -e "\n${BLUE}NodePort:${NC}"
        echo "  http://${node_ip}:${node_port}"
    fi
    
    echo -e "\n${BLUE}Port-Forward:${NC}"
    echo "  ./k8s/deploy.sh ${ENV} port-forward"
    echo "  http://localhost:9080"
    
    echo -e "\n${BLUE}Frontend:${NC}"
    echo "  kubectl port-forward svc/${ENV}-koduck-frontend 8080:80 -n ${NAMESPACE}"
    echo "  http://localhost:8080"
    
    if [ "$ENV" == "prod" ]; then
        echo -e "\n${BLUE}Admin API:${NC}"
        echo "  http://localhost:9180"
        echo "  X-API-KEY: edd1c9f034335f136f87ad84b625c8f1"
    fi
}

# 主流程
main() {
    check_kubectl
    
    case $ACTION in
        install)
            install
            ;;
        uninstall)
            echo -e "${YELLOW}请使用 uninstall.sh 脚本${NC}"
            echo "  ./k8s/uninstall.sh ${ENV}"
            exit 0
            ;;
        status)
            status
            ;;
        port-forward)
            port_forward
            ;;
        logs)
            logs
            ;;
    esac
}

main "$@"
