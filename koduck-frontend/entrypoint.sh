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
json_log "info" "starting_nginx"

exec nginx -g "daemon off;"
