#!/usr/bin/env bash

set -euo pipefail

# E2E smoke checks for koduck-user via APISIX
# Covers:
# - public auth login (demo/demo123)
# - internal key-auth protection (401 on missing/wrong key, 200 on correct key)

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

readonly APISIX_BASE_URL="${APISIX_BASE_URL:-http://127.0.0.1:19080}"
readonly USERNAME="${E2E_USERNAME:-demo}"
readonly PASSWORD="${E2E_PASSWORD:-demo123}"
readonly INTERNAL_API_KEY_USER="${INTERNAL_API_KEY_USER:-uk_test_key_12345678}"

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
  -d "{\"username\":\"${USERNAME}\",\"password\":\"${PASSWORD}\"}")"
assert_http_code "${LOGIN_CODE}" "200" "login should succeed via public API"
log "login passed"

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
  "${APISIX_BASE_URL}/internal/users/by-username/${USERNAME}")"
assert_http_code "${GOOD_KEY_CODE}" "200" "internal API should accept valid apikey"
log "internal valid key -> 200 passed"

log "All APISIX e2e smoke checks passed."
