#!/usr/bin/env bash

set -euo pipefail

TEMPORAL_SERVER_IP="${TEMPORAL_SERVER_IP:-127.0.0.1}"
TEMPORAL_SERVER_PORT="${TEMPORAL_SERVER_PORT:-7233}"
TEMPORAL_UI_PORT="${TEMPORAL_UI_PORT:-8233}"
TEMPORAL_DB_FILENAME="${TEMPORAL_DB_FILENAME:-.temporal/dev.sqlite3}"

if ! command -v temporal >/dev/null 2>&1; then
  echo "Temporal CLI not found. Install it first so root bun dev can start the local server." >&2
  exit 1
fi

mkdir -p "$(dirname "$TEMPORAL_DB_FILENAME")"

ARGS=(
  server
  start-dev
  --ip "$TEMPORAL_SERVER_IP"
  --port "$TEMPORAL_SERVER_PORT"
  --ui-port "$TEMPORAL_UI_PORT"
  --db-filename "$TEMPORAL_DB_FILENAME"
)

if [[ "${TEMPORAL_HEADLESS:-0}" == "1" ]]; then
  ARGS+=(--headless)
fi

exec temporal "${ARGS[@]}"
