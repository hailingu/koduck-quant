# ADR-0021: APISIX Route Setup Script Improvements

- Status: Accepted
- Date: 2026-04-08
- Issue: #670

## Context

Current APISIX route initialization script (`scripts/apisix-route-init-auth.sh`) has several critical issues:

1. **Poor Error Handling**: `curl | echo` pattern hides exit codes, `set -e` cannot catch failures
2. **No HTTP Status Checking**: Does not verify HTTP response codes from APISIX Admin API
3. **No Retry Logic**: Network failures cause immediate script failure
4. **No Rollback**: Partial failures leave system in inconsistent state
5. **Missing gRPC Reflection Route**: Route 4 for gRPC Server Reflection not configured
6. **No Dry-Run Mode**: Cannot preview changes before applying
7. **Poor Output**: Always prints "Created..." regardless of actual API response

## Decision

### 1. Proper Error Handling

Replace `curl | echo` pattern with proper error checking:

```bash
# Before (bad)
curl -s ... | echo "Created..."

# After (good)
response=$(curl -s -w "%{http_code}" ...)
http_code=${response: -3}
body=${response%???}

if [[ $http_code -eq 200 || $http_code -eq 201 ]]; then
    echo "Success: ..."
else
    echo "Error: HTTP $http_code"
    exit 1
fi
```

### 2. Retry Logic

Implement exponential backoff retry (3 attempts):

```bash
retry_count=3
retry_delay=2

for ((i=1; i<=retry_count; i++)); do
    if make_request; then
        return 0
    fi
    sleep $((retry_delay * i))
done
```

### 3. Rollback Functionality

Track created resources and provide rollback on failure:

```bash
rollback() {
    echo "Rolling back changes..."
    # Delete created upstreams and routes
}
trap rollback EXIT
```

### 4. Dry-Run Mode

Add `--dry-run` flag to preview changes:

```bash
if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY RUN] Would create upstream: ..."
    return 0
fi
```

### 5. Route Status Checking

Check existing routes before update to report "created" vs "updated":

```bash
check_route_exists() {
    http_code=$(curl -s -o /dev/null -w "%{http_code}" ...)
    if [[ $http_code -eq 200 ]]; then
        echo "update"
    else
        echo "create"
    fi
}
```

### 6. gRPC Server Reflection Route

Add Route 4 for gRPC reflection:

```json
{
    "uri": "/grpc.reflection.v1alpha.ServerReflection/*",
    "upstream_id": "koduck-auth-grpc",
    "priority": 100
}
```

## Consequences

### Positive

- **Reliability**: Proper error handling and retry logic
- **Safety**: Rollback on failure, dry-run mode
- **Observability**: Clear output showing actual API responses
- **Completeness**: All routes including gRPC reflection configured

### Trade-offs

- **Complexity**: Script is more complex (but more robust)
- **Execution Time**: Retry logic adds potential delay

## Implementation

1. Rewrite script with proper error handling
2. Add retry logic with exponential backoff
3. Implement rollback mechanism
4. Add dry-run mode
5. Add route existence checking
6. Add gRPC Server Reflection route

## References

- Task: koduck-auth/docs/implementation/koduck-auth-rust-grpc-tasks.md Task 7.5
- APISIX Admin API: https://apisix.apache.org/docs/apisix/admin-api/
