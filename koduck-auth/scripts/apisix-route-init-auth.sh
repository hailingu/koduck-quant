#!/bin/bash
# APISIX route initialization script for koduck-auth
# Features: error handling, retry logic, rollback, dry-run mode

set -euo pipefail

# Configuration
APISIX_ADMIN_URL="${APISIX_ADMIN_URL:-http://apisix-admin:9180}"
APISIX_API_KEY="${APISIX_API_KEY:-edd1c9f034335f136f87ad84b625c8f1}"

# Retry configuration
RETRY_COUNT=3
RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track created resources for rollback
CREATED_UPSTREAMS=()
CREATED_ROUTES=()
DRY_RUN=false

# Print usage
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Initialize APISIX routes for koduck-auth service.

OPTIONS:
    -d, --dry-run      Preview changes without applying
    -r, --rollback     Rollback (delete) all routes and upstreams
    -h, --help         Show this help message

EXAMPLES:
    $0                    # Create/update routes
    $0 --dry-run          # Preview changes
    $0 --rollback         # Delete all routes and upstreams

ENVIRONMENT:
    APISIX_ADMIN_URL      APISIX admin API URL (default: http://apisix-admin:9180)
    APISIX_API_KEY        APISIX admin API key
EOF
}

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Rollback function
cleanup() {
    if [[ "$DRY_RUN" == "true" ]]; then
        return
    fi
    
    if [[ ${#CREATED_ROUTES[@]} -gt 0 || ${#CREATED_UPSTREAMS[@]} -gt 0 ]]; then
        log_warn "Cleaning up created resources..."
        
        for route in "${CREATED_ROUTES[@]}"; do
            curl -s -X DELETE \
                "${APISIX_ADMIN_URL}/apisix/admin/routes/${route}" \
                -H "X-API-KEY: ${APISIX_API_KEY}" \
                -o /dev/null || true
        done
        
        for upstream in "${CREATED_UPSTREAMS[@]}"; do
            curl -s -X DELETE \
                "${APISIX_ADMIN_URL}/apisix/admin/upstreams/${upstream}" \
                -H "X-API-KEY: ${APISIX_API_KEY}" \
                -o /dev/null || true
        done
    fi
}

# Set trap for cleanup on exit
trap cleanup EXIT

# Check if resource exists
check_exists() {
    local resource_type=$1
    local resource_id=$2
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        "${APISIX_ADMIN_URL}/apisix/admin/${resource_type}/${resource_id}" \
        -H "X-API-KEY: ${APISIX_API_KEY}")
    
    if [[ "$http_code" == "200" ]]; then
        echo "exists"
    else
        echo "not_exists"
    fi
}

# Make API request with retry
api_request() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    
    local full_url="${APISIX_ADMIN_URL}${url}"
    local response
    local http_code
    local body
    
    for ((i=1; i<=RETRY_COUNT; i++)); do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would ${method} ${description}"
            return 0
        fi
        
        # Make request and capture response with HTTP code
        response=$(curl -s -w "\n%{http_code}" \
            -X "$method" \
            "$full_url" \
            -H "X-API-KEY: ${APISIX_API_KEY}" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1) || true
        
        # Extract HTTP code (last line) and body
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        # Check if successful
        if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
            echo "$body"
            return 0
        fi
        
        # Retry on transient errors
        if [[ $i -lt $RETRY_COUNT ]]; then
            log_warn "Attempt $i failed (HTTP $http_code), retrying in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done
    
    log_error "Failed to ${description} after ${RETRY_COUNT} attempts (HTTP ${http_code})"
    log_error "Response: $body"
    return 1
}

# Create upstream
create_upstream() {
    local id=$1
    local nodes=$2
    local scheme=${3:-"http"}
    local type=${4:-"roundrobin"}
    
    local exists
    exists=$(check_exists "upstreams" "$id")
    
    local data
    data=$(cat <<EOF
{
    "id": "${id}",
    "nodes": ${nodes},
    "type": "${type}",
    "scheme": "${scheme}"
}
EOF
)
    
    local action
    if [[ "$exists" == "exists" ]]; then
        action="updated"
    else
        action="created"
    fi
    
    local response
    response=$(api_request "PUT" "/apisix/admin/upstreams/${id}" "$data" "create upstream: $id")
    
    if [[ "$DRY_RUN" != "true" ]]; then
        CREATED_UPSTREAMS+=("$id")
        log_success "Upstream '$id' ${action} successfully"
        
        # Parse and display key info from response
        local node_count
        node_count=$(echo "$response" | grep -o '"nodes":{[^}]*}' | grep -o '"[^"]*":' | wc -l)
        log_info "  Nodes: ${node_count}, Scheme: ${scheme}"
    fi
}

# Create route
create_route() {
    local id=$1
    local upstream_id=$2
    local uri=$3
    local plugins=${4:-"{}"}
    local priority=${5:-100}
    
    local exists
    exists=$(check_exists "routes" "$id")
    
    local data
    data=$(cat <<EOF
{
    "id": "${id}",
    "uri": "${uri}",
    "upstream_id": "${upstream_id}",
    "plugins": ${plugins},
    "priority": ${priority}
}
EOF
)
    
    local action
    if [[ "$exists" == "exists" ]]; then
        action="updated"
    else
        action="created"
    fi
    
    local response
    response=$(api_request "PUT" "/apisix/admin/routes/${id}" "$data" "create route: $id")
    
    if [[ "$DRY_RUN" != "true" ]]; then
        CREATED_ROUTES+=("$id")
        log_success "Route '$id' (${uri}) ${action} successfully"
        
        # Display plugins if any
        if [[ "$plugins" != "{}" ]]; then
            log_info "  Plugins: $(echo "$plugins" | tr -d '{}\" ')"
        fi
    fi
}

# Rollback all routes and upstreams
rollback_all() {
    log_info "Rolling back all routes and upstreams..."
    
    # Delete routes
    local routes=("koduck-auth-rest" "koduck-auth-jwks" "koduck-auth-grpc" "koduck-auth-grpc-reflection")
    for route in "${routes[@]}"; do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -X DELETE \
            "${APISIX_ADMIN_URL}/apisix/admin/routes/${route}" \
            -H "X-API-KEY: ${APISIX_API_KEY}")
        
        if [[ "$http_code" == "200" || "$http_code" == "204" ]]; then
            log_success "Deleted route: $route"
        elif [[ "$http_code" == "404" ]]; then
            log_warn "Route not found: $route"
        else
            log_error "Failed to delete route: $route (HTTP $http_code)"
        fi
    done
    
    # Delete upstreams
    local upstreams=("koduck-auth-http" "koduck-auth-grpc")
    for upstream in "${upstreams[@]}"; do
        local http_code
        http_code=$(curl -s -o /dev/null -w "%{http_code}" \
            -X DELETE \
            "${APISIX_ADMIN_URL}/apisix/admin/upstreams/${upstream}" \
            -H "X-API-KEY: ${APISIX_API_KEY}")
        
        if [[ "$http_code" == "200" || "$http_code" == "204" ]]; then
            log_success "Deleted upstream: $upstream"
        elif [[ "$http_code" == "404" ]]; then
            log_warn "Upstream not found: $upstream"
        else
            log_error "Failed to delete upstream: $upstream (HTTP $http_code)"
        fi
    done
    
    log_success "Rollback completed"
}

# Main setup function
setup_routes() {
    log_info "Initializing APISIX routes for koduck-auth..."
    log_info "APISIX Admin URL: ${APISIX_ADMIN_URL}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN MODE - No changes will be applied"
    fi
    
    # Create upstreams
    log_info "Creating upstreams..."
    
    # Upstream 1: HTTP
    create_upstream "koduck-auth-http" \
        '{"koduck-auth:8081":1}' \
        "http"
    
    # Upstream 2: gRPC
    create_upstream "koduck-auth-grpc" \
        '{"koduck-auth:50051":1}' \
        "grpc"
    
    # Create routes
    log_info "Creating routes..."
    
    # Route 1: Auth REST API
    create_route "koduck-auth-rest" \
        "koduck-auth-http" \
        "/api/v1/auth/*" \
        "{}" \
        100
    
    # Route 2: JWKS endpoint
    create_route "koduck-auth-jwks" \
        "koduck-auth-http" \
        "/.well-known/jwks.json" \
        "{}" \
        100
    
    # Route 3: Internal gRPC AuthService
    create_route "koduck-auth-grpc" \
        "koduck-auth-grpc" \
        "/koduck.auth.v1.AuthService/*" \
        '{"key-auth":{}}' \
        100
    
    # Route 4: gRPC Server Reflection (optional but useful for debugging)
    create_route "koduck-auth-grpc-reflection" \
        "koduck-auth-grpc" \
        "/grpc.reflection.v1alpha.ServerReflection/*" \
        "{}" \
        90
    
    # Clear the cleanup trap since everything succeeded
    trap - EXIT
    
    log_success "APISIX routes initialized successfully!"
    
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "Summary:"
        log_info "  Upstreams: ${#CREATED_UPSTREAMS[@]}"
        log_info "  Routes: ${#CREATED_ROUTES[@]}"
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -r|--rollback)
            rollback_all
            exit 0
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main execution
setup_routes
