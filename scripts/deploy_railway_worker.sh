#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVICE_NAME="${RAILWAY_WORKER_SERVICE_NAME:-engine-temporal-worker}"
RAILWAY_ENVIRONMENT="${RAILWAY_ENVIRONMENT:-production}"
RAILWAY_TEMPORAL_PRIVATE_ADDRESS="${RAILWAY_TEMPORAL_PRIVATE_ADDRESS:-temporal-frontend:7233}"
if [ -z "${RAILWAY_REDIS_URL_REFERENCE:-}" ]; then
  RAILWAY_REDIS_URL_REFERENCE='${{Redis.REDIS_URL}}'
fi

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
  cat <<EOF
Railway project is not linked in this repo.

Link an existing project first, for example:
  railway link --project <project-id> --environment $RAILWAY_ENVIRONMENT

Then re-run this script.
EOF
  exit 1
fi

require_env CONVEX_URL
require_env OPENAI_API_KEY
require_env FIRECRAWL_API_KEY

status_json="$(railway status --json)"
redis_url_value="${REDIS_URL:-$RAILWAY_REDIS_URL_REFERENCE}"

if ! node -e '
const status = JSON.parse(process.argv[1]);
const serviceName = process.argv[2];
const exists = status.services.edges.some((edge) => edge.node.name === serviceName);
process.exit(exists ? 0 : 1);
' "$status_json" "$SERVICE_NAME"; then
  echo "Creating Railway service: $SERVICE_NAME"
  railway add --service "$SERVICE_NAME" >/dev/null
fi

echo "Deploying engine-temporal worker to Railway service: $SERVICE_NAME"
railway up -s "$SERVICE_NAME" -e "$RAILWAY_ENVIRONMENT" -c

echo "Syncing worker environment variables"
worker_vars=(
  "TEMPORAL_ADDRESS=$RAILWAY_TEMPORAL_PRIVATE_ADDRESS"
  "TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-default}"
  "CONVEX_URL=$CONVEX_URL"
  "OPENAI_API_KEY=$OPENAI_API_KEY"
  "FIRECRAWL_API_KEY=$FIRECRAWL_API_KEY"
  "REDIS_URL=$redis_url_value"
)

if [ -n "${REDIS_KEY_PREFIX:-}" ]; then
  worker_vars+=("REDIS_KEY_PREFIX=$REDIS_KEY_PREFIX")
fi

if [ -n "${AXIOM_DATASET:-}" ]; then
  worker_vars+=("AXIOM_DATASET=$AXIOM_DATASET")
fi

if [ -n "${AXIOM_TOKEN:-}" ]; then
  worker_vars+=("AXIOM_TOKEN=$AXIOM_TOKEN")
fi

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  worker_vars+=("ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY")
fi

if [ -n "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ]; then
  worker_vars+=("GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY")
fi

if [ -n "${OPENROUTER_API_KEY:-}" ]; then
  worker_vars+=("OPENROUTER_API_KEY=$OPENROUTER_API_KEY")
fi

if [ -n "${XAI_API_KEY:-}" ]; then
  worker_vars+=("XAI_API_KEY=$XAI_API_KEY")
fi

railway variable set -s "$SERVICE_NAME" -e "$RAILWAY_ENVIRONMENT" \
  "${worker_vars[@]}" >/dev/null

echo
echo "Railway worker is deployed."
echo "Service: $SERVICE_NAME"
echo "Temporal address inside Railway: $RAILWAY_TEMPORAL_PRIVATE_ADDRESS"
echo "Deploy config: railway.toml + repo-root Dockerfile"
echo
echo "Convex still needs public Temporal TCP envs configured separately:"
echo "  TEMPORAL_ADDRESS=<public temporal frontend tcp host:port>"
echo "  TEMPORAL_NAMESPACE=${TEMPORAL_NAMESPACE:-default}"
