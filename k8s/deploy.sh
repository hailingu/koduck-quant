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
    local timeout_seconds="${timeout%s}"
    local elapsed=0
    local ready_count=0
    local total_count=0
    local pod_list=""

    # 使用主动轮询，避免 kubectl wait 在资源短暂抖动时出现 "no matching resources found"
    while true; do
        pod_list="$(kubectl -n "${NAMESPACE}" get pod -l "${label_selector}" \
            -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true)"

        if [ -n "${pod_list}" ]; then
            ready_count=0
            total_count=0

            while IFS= read -r pod_name; do
                [ -z "${pod_name}" ] && continue
                total_count=$((total_count + 1))

                local phase
                local ready_status
                phase="$(kubectl -n "${NAMESPACE}" get pod "${pod_name}" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
                ready_status="$(kubectl -n "${NAMESPACE}" get pod "${pod_name}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"

                if [ "${phase}" = "Running" ] && [ "${ready_status}" = "True" ]; then
                    ready_count=$((ready_count + 1))
                fi
            done <<< "${pod_list}"

            if [ "${total_count}" -gt 0 ] && [ "${ready_count}" -eq "${total_count}" ]; then
                return 0
            fi
        fi

        if [ "${elapsed}" -ge "${timeout_seconds}" ]; then
            echo -e "${RED}错误: ${name_hint} 未在 ${timeout} 内就绪（selector: ${label_selector}）${NC}"
            kubectl -n "${NAMESPACE}" get pod -l "${label_selector}" -o wide || true
            kubectl -n "${NAMESPACE}" get deploy,statefulset -o wide || true
            exit 1
        fi

        sleep 2
        elapsed=$((elapsed + 2))
    done
}

# 修正 koduck-auth Secret 中的服务地址（避免主机名与 namePrefix 不一致）
ensure_koduck_auth_secret_endpoints() {
    local auth_secret_name="${ENV}-koduck-auth-secrets"
    local db_host_default="${ENV}-postgres"
    local redis_host_default="${ENV}-redis"
    local db_url="${KODUCK_AUTH_DATABASE_URL:-postgresql://koduck:koduck_secret@${db_host_default}:5432/koduck_auth}"
    local redis_url="${KODUCK_AUTH_REDIS_URL:-redis://${redis_host_default}:6379}"

    if kubectl -n "${NAMESPACE}" get secret "${auth_secret_name}" >/dev/null 2>&1; then
        kubectl create secret generic "${auth_secret_name}" \
            --from-literal=database-url="${db_url}" \
            --from-literal=redis-url="${redis_url}" \
            -n "${NAMESPACE}" \
            --dry-run=client -o yaml | kubectl apply -f -
    fi
}

# 修正 koduck-user Secret 中的服务地址（避免主机名与 namePrefix 不一致）
ensure_koduck_user_secret_endpoints() {
    local user_secret_name="${ENV}-koduck-user-secrets"
    local db_host_default="${ENV}-postgres"
    local db_url="${KODUCK_USER_DATABASE_URL:-jdbc:postgresql://koduck:koduck_secret@${db_host_default}:5432/user_db}"

    if kubectl -n "${NAMESPACE}" get secret "${user_secret_name}" >/dev/null 2>&1; then
        kubectl create secret generic "${user_secret_name}" \
            --from-literal=database-url="${db_url}" \
            --from-literal=db-username="koduck" \
            --from-literal=db-password="koduck_secret" \
            -n "${NAMESPACE}" \
            --dry-run=client -o yaml | kubectl apply -f -
    fi
}

# 校验 private/public 是否为一对可用 RSA 密钥
validate_rsa_keypair() {
    local private_key="$1"
    local public_key="$2"
    local derived_pub=""

    if ! openssl rsa -in "${private_key}" -check -noout >/dev/null 2>&1; then
        return 1
    fi

    derived_pub="$(openssl rsa -in "${private_key}" -pubout 2>/dev/null || true)"
    [ -z "${derived_pub}" ] && return 1

    if ! diff -q <(printf "%s\n" "${derived_pub}") "${public_key}" >/dev/null 2>&1; then
        return 1
    fi

    return 0
}

# 确保 koduck-auth JWT RSA 密钥 secret 可用
# - secret 已存在：直接复用（避免 rollout/重复 install 导致 key 漂移）
# - secret 不存在：生成新密钥（典型于 uninstall -> install）
ensure_koduck_auth_jwt_keys_secret() {
    local jwt_secret_name="${ENV}-koduck-auth-jwt-keys"
    local tmp_dir=""
    local private_key=""
    local public_key=""

    if ! command -v openssl &> /dev/null; then
        echo -e "${RED}错误: 未找到 openssl，无法生成 JWT RSA 密钥${NC}"
        exit 1
    fi

    tmp_dir="$(mktemp -d)"
    private_key="${tmp_dir}/private.pem"
    public_key="${tmp_dir}/public.pem"

    if kubectl -n "${NAMESPACE}" get secret "${jwt_secret_name}" >/dev/null 2>&1; then
        if kubectl -n "${NAMESPACE}" get secret "${jwt_secret_name}" -o jsonpath='{.data.private\.pem}' | base64 -d > "${private_key}" 2>/dev/null \
            && kubectl -n "${NAMESPACE}" get secret "${jwt_secret_name}" -o jsonpath='{.data.public\.pem}' | base64 -d > "${public_key}" 2>/dev/null \
            && validate_rsa_keypair "${private_key}" "${public_key}"; then
            rm -rf "${tmp_dir}"
            echo -e "${GREEN}✓ 复用已有 ${jwt_secret_name}${NC}"
            return 0
        fi

        echo -e "${YELLOW}检测到已有 ${jwt_secret_name} 但格式无效，自动重建...${NC}"
    fi

    # 使用未加密 PKCS#1 私钥，兼容 jsonwebtoken::EncodingKey::from_rsa_pem
    openssl genrsa -traditional -out "${private_key}" 2048 >/dev/null 2>&1
    openssl rsa -in "${private_key}" -pubout -out "${public_key}" >/dev/null 2>&1

    if ! validate_rsa_keypair "${private_key}" "${public_key}"; then
        rm -rf "${tmp_dir}"
        echo -e "${RED}错误: 生成的 JWT RSA 密钥校验失败${NC}"
        exit 1
    fi

    kubectl create secret generic "${jwt_secret_name}" \
        --from-file=private.pem="${private_key}" \
        --from-file=public.pem="${public_key}" \
        -n "${NAMESPACE}" \
        --dry-run=client -o yaml | kubectl apply -f -

    rm -rf "${tmp_dir}"
    echo -e "${GREEN}✓ 已创建 ${jwt_secret_name}${NC}"
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

    # 先确保 koduck-auth JWT key secret 可用，再部署工作负载，减少首次启动抖动
    ensure_koduck_auth_jwt_keys_secret

    ensure_etcd_pvc_ready

    # 清理已完成的旧 init Job，确保重新注册路由
    kubectl delete job "${ENV}-apisix-route-init" -n "${NAMESPACE}" --ignore-not-found=true --wait=false 2>/dev/null || true

    # 阶段一：部署基础设施（PostgreSQL + Redis + etcd + APISIX + Frontend + koduck-auth）
    echo -e "${YELLOW}部署基础设施...${NC}"
    if command -v kustomize &> /dev/null; then
        kustomize build --load-restrictor=LoadRestrictionsNone "${SCRIPT_DIR}/overlays/${ENV}" | kubectl apply -f -
    else
        kubectl kustomize --load-restrictor=LoadRestrictionsNone "${SCRIPT_DIR}/overlays/${ENV}" | kubectl apply -f -
    fi

    # 覆盖 auth 连接地址，确保与环境前缀服务名一致（如 dev-postgres）
    ensure_koduck_auth_secret_endpoints

    # 覆盖 user 连接地址
    ensure_koduck_user_secret_endpoints

    echo -e "${YELLOW}等待 PostgreSQL 启动...${NC}"
    wait_pods_ready "app=postgres" "180s" "postgres"

    echo -e "${YELLOW}等待 Redis 启动...${NC}"
    wait_pods_ready "app=redis" "180s" "redis"

    echo -e "${YELLOW}等待 etcd 启动...${NC}"
    wait_pods_ready "app=apisix-etcd" "180s" "etcd"

    echo -e "${YELLOW}等待 APISIX 启动...${NC}"
    wait_pods_ready "app=apisix-gateway" "180s" "APISIX gateway"

    echo -e "${YELLOW}等待 Frontend 启动...${NC}"
    wait_pods_ready "app=koduck-frontend" "180s" "frontend"

    echo -e "${YELLOW}等待 koduck-auth 启动...${NC}"
    wait_pods_ready "app=koduck-auth" "180s" "koduck-auth"

    echo -e "${YELLOW}等待 koduck-user 启动...${NC}"
    wait_pods_ready "app=koduck-user" "180s" "koduck-user"

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
    
    echo -e "\n${BLUE}Auth Service:${NC}"
    echo "  kubectl port-forward svc/${ENV}-koduck-auth 8081:8081 -n ${NAMESPACE}"
    echo "  http://localhost:8081"
    echo "  gRPC: localhost:50051"

    echo -e "\n${BLUE}User Service:${NC}"
    echo "  kubectl port-forward svc/${ENV}-koduck-user 8082:8082 -n ${NAMESPACE}"
    echo "  http://localhost:8082"
    
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
