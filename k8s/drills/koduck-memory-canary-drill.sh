#!/usr/bin/env bash

set -euo pipefail

if ! command -v kubectl >/dev/null 2>&1; then
  echo "ERROR: kubectl is required." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required." >&2
  exit 1
fi

readonly NAMESPACE="${NAMESPACE:-koduck-dev}"
readonly APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://127.0.0.1:19180/apisix/admin}"
readonly APISIX_ADMIN_KEY="${APISIX_ADMIN_KEY:-edd1c9f034335f136f87ad84b625c8f1}"
readonly APISIX_GATEWAY_SERVICE="${APISIX_GATEWAY_SERVICE:-dev-apisix-gateway}"
readonly APISIX_ADMIN_FORWARD_PORT="${APISIX_ADMIN_FORWARD_PORT:-19180}"
readonly AI_DEPLOYMENT="${AI_DEPLOYMENT:-dev-koduck-ai}"
readonly AI_HTTP_URL="${AI_HTTP_URL:-http://127.0.0.1:18083}"
readonly AI_HTTP_FORWARD_PORT="${AI_HTTP_FORWARD_PORT:-18083}"
readonly MEMORY_DEPLOYMENT="${MEMORY_DEPLOYMENT:-dev-koduck-memory}"
readonly MEMORY_CANARY_DEPLOYMENT="${MEMORY_CANARY_DEPLOYMENT:-dev-koduck-memory-canary}"
readonly MEMORY_STABLE_UPSTREAM="${MEMORY_STABLE_UPSTREAM:-dev-koduck-memory-grpc:50051}"
readonly MEMORY_CANARY_UPSTREAM="${MEMORY_CANARY_UPSTREAM:-dev-koduck-memory-canary-grpc:50051}"
readonly MEMORY_CANARY_IMAGE="${MEMORY_CANARY_IMAGE:-koduck-memory:dev}"
readonly TENANT_ID="${E2E_TENANT_ID:-tenant_demo}"
readonly USER_ID="${E2E_USER_ID:-task8-drill-user}"
readonly USERNAME="${E2E_USERNAME:-task8-drill-user}"
TMP_DIR="$(mktemp -d -t koduck-memory-task84-XXXXXX)"
ORIGINAL_UPSTREAM_FILE="${TMP_DIR}/ai-memory-grpc-original.json"
PORT_FORWARD_LOG="${TMP_DIR}/apisix-admin-port-forward.log"
AI_FORWARD_LOG="${TMP_DIR}/koduck-ai-port-forward.log"
PORT_FORWARD_PID=""
AI_FORWARD_PID=""
ORIGINAL_STUB_VALUE=""
AI_STUB_WAS_PRESENT=0

log() {
  printf '[task8-4-drill] %s\n' "$*"
}

cleanup() {
  set +e

  if [[ -f "${ORIGINAL_UPSTREAM_FILE}" ]]; then
    log "Restoring original ai-memory-grpc upstream"
    curl --noproxy '*' -fsS -X PUT "${APISIX_ADMIN_URL}/upstreams/ai-memory-grpc" \
      -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
      -H 'Content-Type: application/json' \
      --data "@${ORIGINAL_UPSTREAM_FILE}" >/dev/null || true
  fi

  if [[ -n "${ORIGINAL_STUB_VALUE}" ]]; then
    log "Restoring koduck-ai stub mode to ${ORIGINAL_STUB_VALUE}"
    kubectl -n "${NAMESPACE}" set env deployment/"${AI_DEPLOYMENT}" \
      KODUCK_AI__LLM__STUB_ENABLED="${ORIGINAL_STUB_VALUE}" >/dev/null || true
    kubectl -n "${NAMESPACE}" rollout status deployment/"${AI_DEPLOYMENT}" --timeout=180s >/dev/null || true
  elif [[ "${AI_STUB_WAS_PRESENT}" -eq 0 ]]; then
    log "Removing temporary koduck-ai stub mode env"
    kubectl -n "${NAMESPACE}" set env deployment/"${AI_DEPLOYMENT}" KODUCK_AI__LLM__STUB_ENABLED- >/dev/null || true
    kubectl -n "${NAMESPACE}" rollout status deployment/"${AI_DEPLOYMENT}" --timeout=180s >/dev/null || true
  fi

  log "Cleaning up canary deployment and service"
  kubectl -n "${NAMESPACE}" delete deployment/"${MEMORY_CANARY_DEPLOYMENT}" --ignore-not-found=true >/dev/null || true
  kubectl -n "${NAMESPACE}" delete service/dev-koduck-memory-canary --ignore-not-found=true >/dev/null || true
  kubectl -n "${NAMESPACE}" delete service/dev-koduck-memory-canary-grpc --ignore-not-found=true >/dev/null || true

  if [[ -n "${PORT_FORWARD_PID}" ]]; then
    kill "${PORT_FORWARD_PID}" >/dev/null 2>&1 || true
    wait "${PORT_FORWARD_PID}" >/dev/null 2>&1 || true
  fi
  if [[ -n "${AI_FORWARD_PID}" ]]; then
    kill "${AI_FORWARD_PID}" >/dev/null 2>&1 || true
    wait "${AI_FORWARD_PID}" >/dev/null 2>&1 || true
  fi

  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

start_apisix_admin_port_forward() {
  log "Starting APISIX admin port-forward on localhost:${APISIX_ADMIN_FORWARD_PORT}"
  kubectl -n "${NAMESPACE}" port-forward service/"${APISIX_GATEWAY_SERVICE}" \
    "${APISIX_ADMIN_FORWARD_PORT}:9180" >"${PORT_FORWARD_LOG}" 2>&1 &
  PORT_FORWARD_PID=$!

  for _ in $(seq 1 30); do
    if curl --noproxy '*' -fsS -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
      "${APISIX_ADMIN_URL}/routes" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "ERROR: APISIX admin port-forward did not become ready." >&2
  cat "${PORT_FORWARD_LOG}" >&2 || true
  exit 1
}

start_ai_port_forward() {
  local ai_pod
  ai_pod="$(latest_ai_pod)"
  if [[ -z "${ai_pod}" ]]; then
    echo "ERROR: unable to resolve latest running koduck-ai pod" >&2
    exit 1
  fi

  log "Starting koduck-ai HTTP port-forward on localhost:${AI_HTTP_FORWARD_PORT}"
  kubectl -n "${NAMESPACE}" port-forward pod/"${ai_pod}" \
    "${AI_HTTP_FORWARD_PORT}:8083" >"${AI_FORWARD_LOG}" 2>&1 &
  AI_FORWARD_PID=$!

  for _ in $(seq 1 30); do
    if curl --noproxy '*' -fsS "${AI_HTTP_URL}/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "ERROR: koduck-ai port-forward did not become ready." >&2
  cat "${AI_FORWARD_LOG}" >&2 || true
  exit 1
}

latest_ai_pod() {
  kubectl -n "${NAMESPACE}" get pods -l app=koduck-ai -o json \
    | jq -r '
      .items
      | map(select(.status.phase == "Running"))
      | sort_by(.metadata.creationTimestamp)
      | last
      | .metadata.name // empty
    '
}

backup_upstream() {
  log "Backing up ai-memory-grpc upstream"
  curl --noproxy '*' -fsS -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
    "${APISIX_ADMIN_URL}/upstreams/ai-memory-grpc" \
    | jq '.value | del(.create_time, .update_time)' >"${ORIGINAL_UPSTREAM_FILE}"
}

write_upstream_nodes() {
  local nodes_json="$1"
  local output_file="$2"
  jq --argjson nodes "${nodes_json}" '.nodes = $nodes' \
    "${ORIGINAL_UPSTREAM_FILE}" >"${output_file}"
}

apply_upstream_payload() {
  local payload_file="$1"
  curl --noproxy '*' -fsS -X PUT "${APISIX_ADMIN_URL}/upstreams/ai-memory-grpc" \
    -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
    -H 'Content-Type: application/json' \
    --data "@${payload_file}" >/dev/null
}

capture_ai_stub_setting() {
  ORIGINAL_STUB_VALUE="$(
    kubectl -n "${NAMESPACE}" get deployment "${AI_DEPLOYMENT}" -o json \
      | jq -r '
        .spec.template.spec.containers[]
        | select(.name == "koduck-ai")
        | [.env[]? | select(.name == "KODUCK_AI__LLM__STUB_ENABLED")][0].value // empty
      '
  )"

  if [[ -n "${ORIGINAL_STUB_VALUE}" ]]; then
    AI_STUB_WAS_PRESENT=1
  fi
}

enable_stub_mode() {
  capture_ai_stub_setting
  log "Enabling koduck-ai stub mode for deterministic drill traffic"
  kubectl -n "${NAMESPACE}" set env deployment/"${AI_DEPLOYMENT}" \
    KODUCK_AI__LLM__STUB_ENABLED=true >/dev/null
  kubectl -n "${NAMESPACE}" rollout status deployment/"${AI_DEPLOYMENT}" --timeout=180s >/dev/null
}

apply_canary_resources() {
  log "Applying temporary canary deployment/service"
  kubectl apply -n "${NAMESPACE}" -f - <<EOF >/dev/null
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${MEMORY_CANARY_DEPLOYMENT}
  labels:
    app: koduck-memory-canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: koduck-memory-canary
  template:
    metadata:
      labels:
        app: koduck-memory-canary
        rollout: canary
    spec:
      initContainers:
        - name: wait-for-object-store
          image: minio/mc:latest
          imagePullPolicy: IfNotPresent
          envFrom:
            - secretRef:
                name: dev-koduck-memory-secrets
          command:
            - /bin/sh
            - -c
            - |
              set -eu
              until mc alias set objectstore "\${OBJECT_STORE__ENDPOINT}" "\${OBJECT_STORE__ACCESS_KEY}" "\${OBJECT_STORE__SECRET_KEY}"; do
                echo "waiting for object store endpoint \${OBJECT_STORE__ENDPOINT}"
                sleep 2
              done
              until mc stat "objectstore/\${OBJECT_STORE__BUCKET}"; do
                echo "waiting for bucket \${OBJECT_STORE__BUCKET}"
                sleep 2
              done
      containers:
        - name: koduck-memory
          image: ${MEMORY_CANARY_IMAGE}
          imagePullPolicy: Never
          ports:
            - name: grpc
              containerPort: 50051
              protocol: TCP
            - name: metrics
              containerPort: 9090
              protocol: TCP
          env:
            - name: SERVER__GRPC_ADDR
              value: "0.0.0.0:50051"
            - name: SERVER__METRICS_ADDR
              value: "0.0.0.0:9090"
            - name: RUST_LOG
              value: "info,koduck_memory=info,tower_http=warn"
          envFrom:
            - secretRef:
                name: dev-koduck-memory-secrets
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /livez
              port: metrics
            initialDelaySeconds: 10
            periodSeconds: 30
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /readyz
              port: metrics
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: dev-koduck-memory-canary
  labels:
    app: koduck-memory-canary
spec:
  type: ClusterIP
  selector:
    app: koduck-memory-canary
  ports:
    - name: grpc
      port: 50051
      targetPort: grpc
      protocol: TCP
    - name: metrics
      port: 9090
      targetPort: metrics
      protocol: TCP
---
apiVersion: v1
kind: Service
metadata:
  name: dev-koduck-memory-canary-grpc
  labels:
    app: koduck-memory-canary
spec:
  type: ClusterIP
  clusterIP: None
  selector:
    app: koduck-memory-canary
  ports:
    - name: grpc
      port: 50051
      targetPort: grpc
      protocol: TCP
EOF

  kubectl -n "${NAMESPACE}" rollout status deployment/"${MEMORY_CANARY_DEPLOYMENT}" --timeout=180s >/dev/null
}

b64url() {
  printf '%s' "$1" | base64 | tr -d '\n=' | tr '+/' '-_'
}

build_fake_jwt() {
  local header payload_json payload
  header="$(b64url '{"alg":"RS256","typ":"JWT"}')"
  payload_json="$(
    jq -cn \
      --arg sub "${USER_ID}" \
      --arg tenant "${TENANT_ID}" \
      --arg username "${USERNAME}" \
      '{sub:$sub,tenant_id:$tenant,username:$username,roles:["user"],exp:4102444800}'
  )"
  payload="$(b64url "${payload_json}")"
  printf '%s.%s.%s' "${header}" "${payload}" "task8drill"
}

chat_once() {
  local token="$1"
  local session_id="$2"
  local output_file="$3"
  curl --noproxy '*' -sS -o "${output_file}" -w '%{http_code}' \
    -H "Authorization: Bearer ${token}" \
    -H "X-Auth-Provider: apisix-oidc" \
    -H "X-Tenant-Id: ${TENANT_ID}" \
    -H "X-Session-Id: ${session_id}" \
    -H 'Content-Type: application/json' \
    -X POST "${AI_HTTP_URL}/api/v1/ai/chat" \
    -d "{\"session_id\":\"${session_id}\",\"message\":\"Task 8.4 drill message for ${session_id}\"}"
}

assert_chat_success() {
  local token="$1"
  local session_id="$2"
  local output_file="${TMP_DIR}/${session_id}.json"
  local code

  code="$(chat_once "${token}" "${session_id}" "${output_file}")"
  if [[ "${code}" != "200" ]]; then
    echo "ERROR: chat request failed, session=${session_id}, http=${code}" >&2
    cat "${output_file}" >&2 || true
    exit 1
  fi

  if [[ "$(jq -r '.success' "${output_file}")" != "true" ]]; then
    echo "ERROR: chat response is not successful, session=${session_id}" >&2
    cat "${output_file}" >&2 || true
    exit 1
  fi

  if [[ -z "$(jq -r '.data.answer // empty' "${output_file}")" ]]; then
    echo "ERROR: chat response missing answer, session=${session_id}" >&2
    cat "${output_file}" >&2 || true
    exit 1
  fi
}

verify_canary_logs() {
  local canary_pod
  canary_pod="$(
    kubectl -n "${NAMESPACE}" get pods -l app=koduck-memory-canary \
      -o jsonpath='{.items[0].metadata.name}'
  )"

  if [[ -z "${canary_pod}" ]]; then
    echo "ERROR: unable to resolve canary pod name" >&2
    exit 1
  fi

  if ! kubectl -n "${NAMESPACE}" logs "${canary_pod}" --since=5m \
    | grep -q "memory rpc completed"; then
    echo "ERROR: canary pod did not receive memory RPC traffic" >&2
    kubectl -n "${NAMESPACE}" logs "${canary_pod}" --since=5m >&2 || true
    exit 1
  fi
}

verify_fail_open_log() {
  local ai_pod
  local log_file
  ai_pod="$(latest_ai_pod)"
  if [[ -z "${ai_pod}" ]]; then
    echo "ERROR: unable to resolve latest running koduck-ai pod for log verification" >&2
    exit 1
  fi

  log_file="${TMP_DIR}/koduck-ai-fail-open.log"
  kubectl -n "${NAMESPACE}" logs "${ai_pod}" --since=5m >"${log_file}"

  if ! grep -Eq "get_session failed; continuing with empty session snapshot|upsert_session_meta failed; continuing with request-local session context|query_memory failed; continuing without retrieved memory hits|append_memory failed after chat response; continuing with successful answer" "${log_file}"; then
    echo "ERROR: fail-open warning log not found in koduck-ai logs" >&2
    cat "${log_file}" >&2 || true
    exit 1
  fi
}

verify_weighted_config() {
  local stable_weight canary_weight
  stable_weight="$(
    curl --noproxy '*' -fsS -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
      "${APISIX_ADMIN_URL}/upstreams/ai-memory-grpc" \
      | jq -r --arg stable "${MEMORY_STABLE_UPSTREAM}" '.value.nodes[$stable]'
  )"
  canary_weight="$(
    curl --noproxy '*' -fsS -H "X-API-KEY: ${APISIX_ADMIN_KEY}" \
      "${APISIX_ADMIN_URL}/upstreams/ai-memory-grpc" \
      | jq -r --arg canary "${MEMORY_CANARY_UPSTREAM}" '.value.nodes[$canary]'
  )"
  if [[ "${stable_weight}" != "9" || "${canary_weight}" != "1" ]]; then
    echo "ERROR: weighted canary nodes were not applied as expected" >&2
    echo "stable weight: ${stable_weight}, canary weight: ${canary_weight}" >&2
    exit 1
  fi
}

exercise_canary_smoke() {
  local token="$1"
  local canary_file="${TMP_DIR}/upstream-canary-only.json"
  log "Switching ai-memory-grpc upstream to canary-only for smoke validation"
  write_upstream_nodes "{\"${MEMORY_CANARY_UPSTREAM}\":1}" "${canary_file}"
  apply_upstream_payload "${canary_file}"
  assert_chat_success "${token}" "00000000-0000-4000-8000-000000000001"
  verify_canary_logs
  log "Canary-only smoke passed"
}

exercise_weighted_canary() {
  local token="$1"
  local weighted_file="${TMP_DIR}/upstream-weighted.json"
  log "Switching ai-memory-grpc upstream to weighted stable/canary nodes"
  write_upstream_nodes "{\"${MEMORY_STABLE_UPSTREAM}\":9,\"${MEMORY_CANARY_UPSTREAM}\":1}" "${weighted_file}"
  apply_upstream_payload "${weighted_file}"
  verify_weighted_config
  assert_chat_success "${token}" "00000000-0000-4000-8000-000000000002"
  log "Weighted canary configuration verified"
}

exercise_fail_open() {
  local token="$1"
  local fault_file="${TMP_DIR}/upstream-fault.json"
  log "Simulating southbound memory outage through APISIX upstream fault"
  write_upstream_nodes '{"dev-koduck-memory-drill-fault:50051":1}' "${fault_file}"
  apply_upstream_payload "${fault_file}"

  assert_chat_success "${token}" "00000000-0000-4000-8000-000000000003"
  verify_fail_open_log
  log "Fail-open verified: chat kept working while memory upstream was broken"
}

exercise_route_rollback() {
  local token="$1"
  log "Rolling route back to the original stable upstream"
  apply_upstream_payload "${ORIGINAL_UPSTREAM_FILE}"
  assert_chat_success "${token}" "00000000-0000-4000-8000-000000000004"
  log "Route rollback verified"
}

main() {
  start_apisix_admin_port_forward
  backup_upstream
  enable_stub_mode
  start_ai_port_forward
  apply_canary_resources

  local token
  token="$(build_fake_jwt)"

  exercise_canary_smoke "${token}"
  exercise_weighted_canary "${token}"
  exercise_fail_open "${token}"
  exercise_route_rollback "${token}"

  log "Task 8.4 drill completed successfully"
}

main "$@"
