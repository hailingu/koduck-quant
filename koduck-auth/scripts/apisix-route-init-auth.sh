#!/bin/bash
# APISIX route initialization script for koduck-auth

set -e

APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://apisix-admin:9180}"
APISIX_API_KEY="${APISIX_API_KEY:-edd1c9f034335f136f87ad84b625c8f1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Initializing APISIX routes for koduck-auth..."

# Create upstream for koduck-auth HTTP
curl -s "${APISIX_ADMIN_URL}/apisix/admin/upstreams/koduck-auth-http" \
  -H "X-API-KEY: ${APISIX_API_KEY}" \
  -X PUT \
  -d '{
    "nodes": {
      "koduck-auth:8081": 1
    },
    "type": "roundrobin"
  }' | echo "Created upstream: koduck-auth-http"

# Create upstream for koduck-auth gRPC
curl -s "${APISIX_ADMIN_URL}/apisix/admin/upstreams/koduck-auth-grpc" \
  -H "X-API-KEY: ${APISIX_API_KEY}" \
  -X PUT \
  -d '{
    "nodes": {
      "koduck-auth:50051": 1
    },
    "type": "roundrobin",
    "scheme": "grpc"
  }' | echo "Created upstream: koduck-auth-grpc"

# Route 1: Auth REST API
curl -s "${APISIX_ADMIN_URL}/apisix/admin/routes/koduck-auth-rest" \
  -H "X-API-KEY: ${APISIX_API_KEY}" \
  -X PUT \
  -d '{
    "uri": "/api/v1/auth/*",
    "upstream_id": "koduck-auth-http",
    "priority": 100
  }' | echo "Created route: /api/v1/auth/*"

# Route 2: JWKS endpoint
curl -s "${APISIX_ADMIN_URL}/apisix/admin/routes/koduck-auth-jwks" \
  -H "X-API-KEY: ${APISIX_API_KEY}" \
  -X PUT \
  -d '{
    "uri": "/.well-known/jwks.json",
    "upstream_id": "koduck-auth-http",
    "priority": 100
  }' | echo "Created route: /.well-known/jwks.json"

# Route 3: Internal gRPC service
curl -s "${APISIX_ADMIN_URL}/apisix/admin/routes/koduck-auth-grpc" \
  -H "X-API-KEY: ${APISIX_API_KEY}" \
  -X PUT \
  -d '{
    "uri": "/koduck.auth.v1.AuthService/*",
    "upstream_id": "koduck-auth-grpc",
    "plugins": {
      "key-auth": {}
    },
    "priority": 100
  }' | echo "Created route: /koduck.auth.v1.AuthService/*"

echo -e "${GREEN}APISIX routes initialized successfully!${NC}"
