#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="${ROOT_DIR}/.githooks"

if [[ ! -d "${HOOKS_DIR}" ]]; then
  echo "Hooks directory not found: ${HOOKS_DIR}" >&2
  exit 1
fi

if [[ ! -x "${HOOKS_DIR}/pre-commit" ]]; then
  echo "Hook file missing or not executable: ${HOOKS_DIR}/pre-commit" >&2
  exit 1
fi

git -C "${ROOT_DIR}" config core.hooksPath .githooks

echo "Installed git hooks:"
echo "  core.hooksPath=.githooks"
echo "  active hook: .githooks/pre-commit"
