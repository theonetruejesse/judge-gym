#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${RAILWAY_WORKER_SERVICE_NAME:-engine-temporal-worker}"
RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
RAILWAY_PROJECT_ID="${RAILWAY_PROJECT_ID:-}"

source_env() {
  if [ -f "$ROOT_DIR/.env.local" ]; then
    set -a
    source "$ROOT_DIR/.env.local"
    set +a
  fi
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_env() {
  local key="$1"
  if [ -z "${!key:-}" ]; then
    echo "Missing required env var: $key"
    exit 1
  fi
}

source_env

require_cmd railway
require_cmd node

if ! railway status --json >/dev/null 2>&1; then
  require_env RAILWAY_PROJECT_ID
  echo "Linking Railway project $RAILWAY_PROJECT_ID ($RAILWAY_ENVIRONMENT)"
  railway link --project "$RAILWAY_PROJECT_ID" --environment "$RAILWAY_ENVIRONMENT" >/dev/null
fi

status_json="$(railway status --json)"
node -e '
const status = JSON.parse(process.argv[1]);
const serviceName = process.argv[2];
const envName = process.argv[3];
const serviceEdge = status.services.edges.find((edge) => edge.node.name === serviceName);
if (!serviceEdge) {
  console.error(`Missing Railway service: ${serviceName}`);
  process.exit(1);
}
const environmentEdge = status.environments?.edges?.find((edge) => edge.node.name === envName) ?? null;
if (!environmentEdge) {
  console.error(`Missing Railway environment: ${envName}`);
  process.exit(1);
}
console.log(`Railway project linked: ${status.name}`);
console.log(`Railway environment: ${environmentEdge.node.name}`);
console.log(`Railway worker service: ${serviceName}`);
' "$status_json" "$SERVICE_NAME" "$RAILWAY_ENVIRONMENT"

echo "Worker bootstrap prerequisites look good."
