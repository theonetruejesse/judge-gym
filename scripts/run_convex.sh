#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_CONVEX_ROOT="$ROOT_DIR/apps/engine-convex"

if [ -f "$ROOT_DIR/.env.local" ]; then
  set -a
  source "$ROOT_DIR/.env.local"
  set +a
fi

resolve_node_bin() {
  local candidates=()
  local candidate=""
  local major=""

  if [ -n "${JUDGE_GYM_NODE_BIN:-}" ]; then
    candidates+=("$JUDGE_GYM_NODE_BIN")
  fi

  if command -v node >/dev/null 2>&1; then
    candidates+=("$(command -v node)")
  fi

  if [ -d "$HOME/.nvm/versions/node" ]; then
    while IFS= read -r candidate; do
      candidates+=("$candidate")
    done < <(find "$HOME/.nvm/versions/node" -maxdepth 3 -path '*/bin/node' | sort -V -r)
  fi

  for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
    if [ -x "$candidate" ]; then
      candidates+=("$candidate")
    fi
  done

  for candidate in "${candidates[@]}"; do
    if [ ! -x "$candidate" ]; then
      continue
    fi
    major="$("$candidate" -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
    if [ -n "$major" ] && [ "$major" -ge 22 ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

NODE_BIN="$(resolve_node_bin || true)"
if [ -z "$NODE_BIN" ]; then
  echo "judge-gym requires a Node.js >=22 binary. Set JUDGE_GYM_NODE_BIN or install Node 22." >&2
  exit 1
fi

CLI_BUNDLE="$(
  "$NODE_BIN" -e '
const { createRequire } = require("module");
const path = require("path");
const projectRoot = process.argv[1];
const requireFrom = createRequire(path.join(projectRoot, "package.json"));
const packageJsonPath = requireFrom.resolve("convex/package.json");
process.stdout.write(path.join(path.dirname(packageJsonPath), "dist", "cli.bundle.cjs"));
' "$ENGINE_CONVEX_ROOT"
)"

cd "$ENGINE_CONVEX_ROOT"
exec "$NODE_BIN" "$CLI_BUNDLE" run "$@"
