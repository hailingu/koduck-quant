#!/usr/bin/env bash

set -euo pipefail

# APISIX route init script for koduck-user (Task 7.2)
# Features:
# 1) Idempotent PUT for consumer + routes
# 2) Automatic backup before mutation
# 3) Automatic rollback on failure
# 4) Post-apply verification through APISIX Admin API

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for backup/rollback/verification." >&2
  exit 1
fi

readonly APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://apisix-admin:9180/apisix/admin}"
readonly ADMIN_KEY="${ADMIN_KEY:?ADMIN_KEY is required}"
readonly INTERNAL_API_KEY_USER="${INTERNAL_API_KEY_USER:?INTERNAL_API_KEY_USER is required}"
readonly USER_SERVICE_UPSTREAM="${USER_SERVICE_UPSTREAM:-koduck-user:8082}"
readonly USER_PUBLIC_ROUTE_ID="${USER_PUBLIC_ROUTE_ID:-user-service}"
readonly USER_INTERNAL_ROUTE_ID="${USER_INTERNAL_ROUTE_ID:-user-internal}"
readonly USER_CONSUMER_ID="${USER_CONSUMER_ID:-koduck_user_consumer}"
readonly USER_CONSUMER_USERNAME="${USER_CONSUMER_USERNAME:-koduck_user_consumer}"
readonly ROLLBACK_ON_ERROR="${ROLLBACK_ON_ERROR:-true}"
readonly CURL_NO_PROXY="${CURL_NO_PROXY:-*}"

readonly TMP_DIR="$(mktemp -d -t apisix-user-init-XXXXXX)"
readonly BACKUP_DIR="${TMP_DIR}/backup"
readonly PAYLOAD_DIR="${TMP_DIR}/payload"
mkdir -p "${BACKUP_DIR}" "${PAYLOAD_DIR}"

rollback_executed=false

log() {
  printf '[apisix-user-init] %s\n' "$*"
}

request() {
  local method="$1"
  local path="$2"
  local output_file="$3"
  local data_file="${4:-}"
  local http_code

  : > "${output_file}"

  if [[ -n "${data_file}" ]]; then
    http_code="$(curl -sS -o "${output_file}" -w '%{http_code}' \
      --noproxy "${CURL_NO_PROXY}" \
      -X "${method}" "${APISIX_ADMIN_URL}${path}" \
      -H "X-API-KEY: ${ADMIN_KEY}" \
      -H 'Content-Type: application/json' \
      --data "@${data_file}")"
  else
    http_code="$(curl -sS -o "${output_file}" -w '%{http_code}' \
      --noproxy "${CURL_NO_PROXY}" \
      -X "${method}" "${APISIX_ADMIN_URL}${path}" \
      -H "X-API-KEY: ${ADMIN_KEY}" \
      -H 'Content-Type: application/json')"
  fi

  echo "${http_code}"
}

backup_entity() {
  local kind="$1"
  local entity_id="$2"
  local out="${BACKUP_DIR}/${kind}-${entity_id}.json"
  local raw="${TMP_DIR}/raw-${kind}-${entity_id}.json"
  local code

  code="$(request "GET" "/${kind}/${entity_id}" "${raw}")"

  if [[ "${code}" == "404" ]]; then
    printf '__ABSENT__\n' > "${out}"
    log "No existing ${kind}/${entity_id}; backup mark as ABSENT."
    return 0
  fi

  if [[ "${code}" != 2* ]]; then
    echo "ERROR: Failed to backup ${kind}/${entity_id}, HTTP ${code}" >&2
    cat "${raw}" >&2 || true
    return 1
  fi

  jq -c '.value' "${raw}" > "${out}"
  log "Backed up ${kind}/${entity_id}."
}

put_entity() {
  local kind="$1"
  local entity_id="$2"
  local payload_file="$3"
  local out="${TMP_DIR}/put-${kind}-${entity_id}.json"
  local code

  code="$(request "PUT" "/${kind}/${entity_id}" "${out}" "${payload_file}")"
  if [[ "${code}" != 2* ]]; then
    echo "ERROR: Failed to PUT ${kind}/${entity_id}, HTTP ${code}" >&2
    cat "${out}" >&2 || true
    return 1
  fi
  log "Applied ${kind}/${entity_id}."
}

delete_entity_if_exists() {
  local kind="$1"
  local entity_id="$2"
  local out="${TMP_DIR}/delete-${kind}-${entity_id}.json"
  local code

  code="$(request "DELETE" "/${kind}/${entity_id}" "${out}")"
  if [[ "${code}" == "404" ]]; then
    return 0
  fi
  if [[ "${code}" != 2* ]]; then
    echo "WARN: Failed to DELETE ${kind}/${entity_id}, HTTP ${code}" >&2
    cat "${out}" >&2 || true
    return 1
  fi
  return 0
}

rollback() {
  if [[ "${rollback_executed}" == "true" ]]; then
    return 0
  fi
  rollback_executed=true

  if [[ "${ROLLBACK_ON_ERROR}" != "true" ]]; then
    log "Rollback skipped (ROLLBACK_ON_ERROR=${ROLLBACK_ON_ERROR})."
    return 0
  fi

  log "Failure detected, rolling back APISIX entities..."

  local mappings=(
    "consumers:${USER_CONSUMER_ID}"
    "routes:${USER_PUBLIC_ROUTE_ID}"
    "routes:${USER_INTERNAL_ROUTE_ID}"
  )

  local item kind entity_id backup_file
  for item in "${mappings[@]}"; do
    kind="${item%%:*}"
    entity_id="${item##*:}"
    backup_file="${BACKUP_DIR}/${kind}-${entity_id}.json"

    if [[ ! -f "${backup_file}" ]]; then
      log "Skip rollback for ${kind}/${entity_id}, no backup."
      continue
    fi

    if grep -q '__ABSENT__' "${backup_file}"; then
      delete_entity_if_exists "${kind}" "${entity_id}" || true
      log "Rollback delete ${kind}/${entity_id} (entity absent before apply)."
      continue
    fi

    put_entity "${kind}" "${entity_id}" "${backup_file}" || true
    log "Rollback restore ${kind}/${entity_id}."
  done
}

on_error() {
  echo "ERROR: Script failed at line $1." >&2
  rollback
}
trap 'on_error $LINENO' ERR

create_payloads() {
  jq -n \
    --arg username "${USER_CONSUMER_USERNAME}" \
    --arg key "${INTERNAL_API_KEY_USER}" \
    '{
      username: $username,
      plugins: {
        "key-auth": {
          key: $key
        }
      }
    }' > "${PAYLOAD_DIR}/consumer.json"

  jq -n \
    --arg upstream "${USER_SERVICE_UPSTREAM}" \
    '{
      uri: "/api/v1/users/*",
      priority: 90,
      plugins: {
        "jwt-auth": {},
        "proxy-rewrite": {
          headers: {
            set: {
              "X-User-Id": "$jwt_claim_sub",
              "X-Username": "$jwt_claim_username",
              "X-Roles": "$jwt_claim_roles",
              "X-Tenant-Id": "$jwt_claim_tenant_id"
            }
          }
        }
      },
      upstream: {
        type: "roundrobin",
        nodes: {
          ($upstream): 1
        }
      }
    }' > "${PAYLOAD_DIR}/public-route.json"

  jq -n \
    --arg upstream "${USER_SERVICE_UPSTREAM}" \
    '{
      uri: "/internal/users/*",
      priority: 100,
      plugins: {
        "key-auth": {},
        "proxy-rewrite": {
          headers: {
            "X-Consumer-Username": "$consumer_name",
            apikey: ""
          }
        }
      },
      upstream: {
        type: "roundrobin",
        nodes: {
          ($upstream): 1
        }
      }
    }' > "${PAYLOAD_DIR}/internal-route.json"
}

verify_entity_with_jq() {
  local kind="$1"
  local entity_id="$2"
  local jq_expr="$3"
  local description="$4"
  local raw="${TMP_DIR}/verify-${kind}-${entity_id}.json"
  local code

  code="$(request "GET" "/${kind}/${entity_id}" "${raw}")"
  if [[ "${code}" != 2* ]]; then
    echo "ERROR: Verification GET failed for ${kind}/${entity_id}, HTTP ${code}" >&2
    cat "${raw}" >&2 || true
    return 1
  fi

  if ! jq -e "${jq_expr}" "${raw}" >/dev/null; then
    echo "ERROR: Verification mismatch for ${kind}/${entity_id}: ${description}" >&2
    cat "${raw}" >&2 || true
    return 1
  fi
  log "Verified ${kind}/${entity_id}: ${description}"
}

main() {
  log "APISIX admin endpoint: ${APISIX_ADMIN_URL}"
  log "Start backup..."
  backup_entity "consumers" "${USER_CONSUMER_ID}"
  backup_entity "routes" "${USER_PUBLIC_ROUTE_ID}"
  backup_entity "routes" "${USER_INTERNAL_ROUTE_ID}"

  log "Build payloads..."
  create_payloads

  log "Apply consumer + routes (idempotent PUT)..."
  put_entity "consumers" "${USER_CONSUMER_ID}" "${PAYLOAD_DIR}/consumer.json"
  put_entity "routes" "${USER_PUBLIC_ROUTE_ID}" "${PAYLOAD_DIR}/public-route.json"
  put_entity "routes" "${USER_INTERNAL_ROUTE_ID}" "${PAYLOAD_DIR}/internal-route.json"

  log "Verify applied config by Admin API..."
  verify_entity_with_jq \
    "consumers" \
    "${USER_CONSUMER_ID}" \
    ".value.username == \"${USER_CONSUMER_USERNAME}\" and .value.plugins[\"key-auth\"].key == \"${INTERNAL_API_KEY_USER}\"" \
    "consumer username/key-auth key"
  verify_entity_with_jq \
    "routes" \
    "${USER_PUBLIC_ROUTE_ID}" \
    ".value.uri == \"/api/v1/users/*\" and .value.priority == 90 and (.value.plugins | has(\"jwt-auth\")) and .value.plugins[\"proxy-rewrite\"].headers.set[\"X-User-Id\"] == \"\$jwt_claim_sub\" and .value.plugins[\"proxy-rewrite\"].headers.set[\"X-Username\"] == \"\$jwt_claim_username\" and .value.plugins[\"proxy-rewrite\"].headers.set[\"X-Roles\"] == \"\$jwt_claim_roles\" and .value.plugins[\"proxy-rewrite\"].headers.set[\"X-Tenant-Id\"] == \"\$jwt_claim_tenant_id\" and .value.upstream.nodes[\"${USER_SERVICE_UPSTREAM}\"] == 1" \
    "public route uri/priority/jwt-auth/proxy-rewrite/upstream"
  verify_entity_with_jq \
    "routes" \
    "${USER_INTERNAL_ROUTE_ID}" \
    ".value.uri == \"/internal/users/*\" and .value.priority == 100 and (.value.plugins | has(\"key-auth\")) and .value.plugins[\"proxy-rewrite\"].headers[\"X-Consumer-Username\"] == \"\$consumer_name\" and .value.plugins[\"proxy-rewrite\"].headers[\"apikey\"] == \"\" and .value.upstream.nodes[\"${USER_SERVICE_UPSTREAM}\"] == 1" \
    "internal route uri/priority/key-auth/proxy-rewrite/upstream"

  log "Task 7.2 APISIX route init completed successfully."
  log "Replay command: ADMIN_KEY=*** INTERNAL_API_KEY_USER=*** ${BASH_SOURCE[0]}"
}

main "$@"
