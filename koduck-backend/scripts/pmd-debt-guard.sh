#!/usr/bin/env bash
# PMD 存量治理守门脚本（新增零容忍 + 存量非回退）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BASELINE_FILE="${PMD_BASELINE_FILE:-${PROJECT_ROOT}/config/pmd/debt-baseline.txt}"
REPORT_FILE="${PMD_REPORT_FILE:-${PROJECT_ROOT}/target/pmd.xml}"

RUN_SCAN=true
UPDATE_BASELINE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-scan)
            RUN_SCAN=false
            shift
            ;;
        --update-baseline)
            UPDATE_BASELINE=true
            shift
            ;;
        --baseline-file)
            BASELINE_FILE="$2"
            shift 2
            ;;
        --report-file)
            REPORT_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown argument: $1" >&2
            echo "Usage: $0 [--skip-scan] [--update-baseline] [--baseline-file <path>] [--report-file <path>]" >&2
            exit 2
            ;;
    esac
done

if [[ ! -f "${BASELINE_FILE}" ]]; then
    echo "PMD baseline file not found: ${BASELINE_FILE}" >&2
    exit 2
fi

BASELINE_COUNT="$(tr -d '[:space:]' < "${BASELINE_FILE}")"
if [[ ! "${BASELINE_COUNT}" =~ ^[0-9]+$ ]]; then
    echo "Invalid baseline count in ${BASELINE_FILE}: ${BASELINE_COUNT}" >&2
    exit 2
fi

if [[ "${RUN_SCAN}" == "true" ]]; then
    echo "Running PMD scan..."
    mvn -q -f "${PROJECT_ROOT}/pom.xml" pmd:pmd
fi

if [[ ! -f "${REPORT_FILE}" ]]; then
    echo "PMD report not found: ${REPORT_FILE}" >&2
    exit 2
fi

CURRENT_COUNT="$(grep -c '<violation' "${REPORT_FILE}" || true)"
if [[ ! "${CURRENT_COUNT}" =~ ^[0-9]+$ ]]; then
    echo "Failed to parse PMD violation count from ${REPORT_FILE}" >&2
    exit 2
fi

echo "PMD baseline violations : ${BASELINE_COUNT}"
echo "PMD current violations  : ${CURRENT_COUNT}"

if [[ "${UPDATE_BASELINE}" == "true" ]]; then
    if (( CURRENT_COUNT > BASELINE_COUNT )); then
        echo "Refuse to update baseline: current (${CURRENT_COUNT}) is higher than baseline (${BASELINE_COUNT})." >&2
        exit 1
    fi
    echo "${CURRENT_COUNT}" > "${BASELINE_FILE}"
    echo "Baseline updated to ${CURRENT_COUNT}: ${BASELINE_FILE}"
    exit 0
fi

if (( CURRENT_COUNT > BASELINE_COUNT )); then
    echo "PMD debt regression detected: ${CURRENT_COUNT} > ${BASELINE_COUNT}" >&2
    exit 1
fi

echo "PMD debt guard passed."
