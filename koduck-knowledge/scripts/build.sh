#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODULE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROFILE="native"
IMAGE_TAG=""
ARTIFACT_TAG=""
MAVEN_MIRROR_URL="${MAVEN_MIRROR_URL:-https://maven.aliyun.com/repository/public}"

usage() {
    cat <<'EOF'
Usage:
  ./scripts/build.sh [--profile native|jvm] [--tag image-tag]

Examples:
  ./scripts/build.sh
  ./scripts/build.sh --profile jvm --tag koduck-knowledge:dev
EOF
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile)
            PROFILE="${2:-}"
            shift 2
            ;;
        --tag)
            IMAGE_TAG="${2:-}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage
            exit 1
            ;;
    esac
done

if [[ ! "${PROFILE}" =~ ^(native|jvm)$ ]]; then
    echo "Unsupported profile: ${PROFILE}" >&2
    exit 1
fi

if [[ -z "${IMAGE_TAG}" ]]; then
    IMAGE_TAG="koduck/koduck-knowledge:${PROFILE}"
fi

ARTIFACT_TAG="koduck-knowledge-build:${PROFILE}"
ARTIFACT_TARGET="${PROFILE}-artifact"
RUNTIME_TARGET="${PROFILE}-runtime"

echo "Building artifact image: ${ARTIFACT_TAG} (${ARTIFACT_TARGET})"
docker build \
    -f "${MODULE_DIR}/Dockerfile.build" \
    --build-arg MAVEN_MIRROR_URL="${MAVEN_MIRROR_URL}" \
    --target "${ARTIFACT_TARGET}" \
    -t "${ARTIFACT_TAG}" \
    "${MODULE_DIR}"

echo "Building runtime image: ${IMAGE_TAG} (${RUNTIME_TARGET})"
docker build \
    -f "${MODULE_DIR}/Dockerfile" \
    --build-arg ARTIFACT_IMAGE="${ARTIFACT_TAG}" \
    --target "${RUNTIME_TARGET}" \
    -t "${IMAGE_TAG}" \
    "${MODULE_DIR}"

echo "Build complete: ${IMAGE_TAG}"
