#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  source "$ROOT_DIR/.env.local"
  set +a
fi

exec npx -y convex@latest mcp start \
  --project-dir "$ROOT_DIR/packages/engine" \
  --disable-tools envList,envGet,envSet,envRemove,tables
