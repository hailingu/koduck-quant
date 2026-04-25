#!/bin/sh
set -eu

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%S.%3NZ"
}

json_log() {
  level="$1"
  event="$2"
  printf '{"timestamp":"%s","logger":"frontend.entrypoint","level":"%s","event":"%s"}\n' \
    "$(timestamp)" "$level" "$event"
}

json_log "info" "frontend_container_starting"

DEFAULT_RUNTIME_CONFIG_JSON='{"llm":{"defaultProvider":"minimax","providers":[{"value":"minimax","label":"MiniMax","defaultModel":"MiniMax-M2.7","models":["MiniMax-M2.7","MiniMax-M2.5"]},{"value":"deepseek","label":"DeepSeek","defaultModel":"deepseek-v4-flash","models":["deepseek-v4-flash","deepseek-v4-pro"]},{"value":"kimi","label":"Kimi","defaultModel":"kimi-for-coding","models":["kimi-for-coding"]}]}}'
RUNTIME_CONFIG_JSON="${KODUCK_FRONTEND_RUNTIME_CONFIG_JSON:-$DEFAULT_RUNTIME_CONFIG_JSON}"
printf '%s\n' "$RUNTIME_CONFIG_JSON" > /usr/share/nginx/html/runtime-config.json
json_log "info" "runtime_config_written"

json_log "info" "starting_nginx"

exec nginx -g "daemon off;"
