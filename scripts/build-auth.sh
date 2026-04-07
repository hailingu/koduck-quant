#!/bin/bash
# Build script for koduck-auth Docker image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUTH_DIR="$PROJECT_ROOT/koduck-auth"
IMAGE_NAME="${KODUCK_AUTH_IMAGE:-koduck/koduck-auth:latest}"
BUILDER_NAME="koduck-builder"

echo "=== Building koduck-auth Docker image ==="
echo "Image: $IMAGE_NAME"
echo "Directory: $AUTH_DIR"
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker buildx is available
if docker buildx version &> /dev/null; then
    echo "Using Docker Buildx for multi-platform builds"
    
    # Create builder if not exists
    if ! docker buildx inspect "$BUILDER_NAME" &> /dev/null; then
        echo "Creating buildx builder: $BUILDER_NAME"
        docker buildx create --name "$BUILDER_NAME" --use
    else
        docker buildx use "$BUILDER_NAME"
    fi
    
    # Build with buildx
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t "$IMAGE_NAME" \
        --load \
        "$AUTH_DIR"
else
    echo "Using standard Docker build"
    docker build -t "$IMAGE_NAME" "$AUTH_DIR"
fi

echo ""
echo "=== Build complete ==="
echo "Image: $IMAGE_NAME"
echo ""
echo "To push to registry:"
echo "  docker push $IMAGE_NAME"
echo ""
echo "To run locally:"
echo "  docker run -p 8081:8081 -p 50051:50051 -p 9090:9090 $IMAGE_NAME"
