#!/usr/bin/env bash

set -euo pipefail

# E2E smoke checks for koduck-user via APISIX
# Covers:
# - public auth login with explicit tenant
# - JWT claim vs introspection consistency
# - public koduck-user route through APISIX
# - internal key-auth + tenant isolation checks

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required." >&2
  exit 1
fi

readonly APISIX_BASE_URL="${APISIX_BASE_URL:-http://127.0.0.1:30080}"
readonly USERNAME="${E2E_USERNAME:-demo}"
readonly PASSWORD="${E2E_PASSWORD:-demo123}"
readonly TENANT_ID="${E2E_TENANT_ID:-default}"
readonly INTERNAL_API_KEY_USER="${INTERNAL_API_KEY_USER:-uk_test_key_12345678}"

decode_jwt_payload() {
  local token="$1"
  local payload
  local mod

  payload="$(printf '%s' "${token}" | cut -d'.' -f2 | tr '_-' '/+')"
  mod=$(( ${#payload} % 4 ))
  if [[ "${mod}" -eq 2 ]]; then
    payload="${payload}=="
  elif [[ "${mod}" -eq 3 ]]; then
    payload="${payload}="
  fi
  printf '%s' "${payload}" | base64 -d 2>/dev/null
}

log() {
  printf '[e2e-koduck-user] %s\n' "$*"
}

assert_http_code() {
  local actual="$1"
  local expected="$2"
  local message="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "ERROR: ${message}, expected=${expected}, actual=${actual}" >&2
    return 1
  fi
}

log "APISIX_BASE_URL=${APISIX_BASE_URL}"

LOGIN_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-login.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -X POST "${APISIX_BASE_URL}/api/v1/auth/login" \
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\",\"tenant_id\":\"${TENANT_ID}\"}")"
assert_http_code "${LOGIN_CODE}" "200" "login should succeed via public API"
log "login passed"

ACCESS_TOKEN="$(jq -r '.data.access_token // .data.tokens.access_token' /tmp/e2e-login.json)"
if [[ -z "${ACCESS_TOKEN}" || "${ACCESS_TOKEN}" == "null" ]]; then
  echo "ERROR: access token missing in login response" >&2
  cat /tmp/e2e-login.json >&2 || true
  exit 1
fi

JWT_PAYLOAD="$(decode_jwt_payload "${ACCESS_TOKEN}")"
CLAIM_TENANT_ID="$(printf '%s' "${JWT_PAYLOAD}" | jq -r '.tenant_id')"
CLAIM_USER_ID="$(printf '%s' "${JWT_PAYLOAD}" | jq -r '.sub')"
CLAIM_USERNAME="$(printf '%s' "${JWT_PAYLOAD}" | jq -r '.username')"

if [[ "${CLAIM_TENANT_ID}" != "${TENANT_ID}" ]]; then
  echo "ERROR: JWT tenant claim mismatch, expected=${TENANT_ID}, actual=${CLAIM_TENANT_ID}" >&2
  exit 1
fi
log "jwt tenant claim matched"

INTROSPECT_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-introspect.json -w '%{http_code}' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -X POST "${APISIX_BASE_URL}/oauth/introspect" \
  --data-urlencode "token=${ACCESS_TOKEN}")"
assert_http_code "${INTROSPECT_CODE}" "200" "token introspection should succeed"
assert_http_code "$(jq -r '.active' /tmp/e2e-introspect.json | tr '[:upper:]' '[:lower:]')" "true" "introspection should mark token active"

INTROSPECT_TENANT_ID="$(jq -r '.tenant_id' /tmp/e2e-introspect.json)"
INTROSPECT_USER_ID="$(jq -r '.sub' /tmp/e2e-introspect.json)"
INTROSPECT_USERNAME="$(jq -r '.username' /tmp/e2e-introspect.json)"

if [[ "${INTROSPECT_TENANT_ID}" != "${CLAIM_TENANT_ID}" || "${INTROSPECT_USER_ID}" != "${CLAIM_USER_ID}" || "${INTROSPECT_USERNAME}" != "${CLAIM_USERNAME}" ]]; then
  echo "ERROR: introspection payload does not match JWT claims" >&2
  cat /tmp/e2e-introspect.json >&2 || true
  exit 1
fi
log "introspection matched jwt claims"

ME_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-users-me.json -w '%{http_code}' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  "${APISIX_BASE_URL}/api/v1/users/me")"
assert_http_code "${ME_CODE}" "200" "public koduck-user route should succeed via APISIX"

ME_USER_ID="$(jq -r '.data.id' /tmp/e2e-users-me.json)"
ME_USERNAME="$(jq -r '.data.username' /tmp/e2e-users-me.json)"
if [[ "${ME_USER_ID}" != "${CLAIM_USER_ID}" || "${ME_USERNAME}" != "${CLAIM_USERNAME}" ]]; then
  echo "ERROR: /api/v1/users/me response does not match JWT claims" >&2
  cat /tmp/e2e-users-me.json >&2 || true
  exit 1
fi
log "public user route matched jwt user identity"

NO_KEY_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-internal-nokey.json -w '%{http_code}' \
  "${APISIX_BASE_URL}/internal/users/by-username/${USERNAME}")"
assert_http_code "${NO_KEY_CODE}" "401" "internal API should reject missing apikey"
log "internal missing key -> 401 passed"

WRONG_KEY_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-internal-wrongkey.json -w '%{http_code}' \
  -H 'apikey: wrong-key' \
  "${APISIX_BASE_URL}/internal/users/by-username/${USERNAME}")"
assert_http_code "${WRONG_KEY_CODE}" "401" "internal API should reject wrong apikey"
log "internal wrong key -> 401 passed"

GOOD_KEY_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-internal-ok.json -w '%{http_code}' \
  -H "apikey: ${INTERNAL_API_KEY_USER}" \
  -H "X-Tenant-Id: ${CLAIM_TENANT_ID}" \
  "${APISIX_BASE_URL}/internal/users/by-username/${USERNAME}")"
assert_http_code "${GOOD_KEY_CODE}" "200" "internal API should accept valid apikey"
log "internal valid key -> 200 passed"

WRONG_TENANT_CODE="$(curl --noproxy '*' -sS -o /tmp/e2e-internal-wrongtenant.json -w '%{http_code}' \
  -H "apikey: ${INTERNAL_API_KEY_USER}" \
  -H "X-Tenant-Id: tenant-other" \
  "${APISIX_BASE_URL}/internal/users/by-username/${USERNAME}")"
assert_http_code "${WRONG_TENANT_CODE}" "404" "internal API should isolate users by tenant"
log "internal wrong tenant -> 404 passed"

log "All APISIX e2e smoke checks passed."
