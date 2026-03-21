#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

missing=()
for cmd in node bun uv convex railway; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    missing+=("$cmd")
  fi
done

if [ ${#missing[@]} -ne 0 ]; then
  echo "Missing required tools: ${missing[*]}"
  echo "Install them and re-run this script."
  exit 1
fi

required_node_major=22
required_node_minor=12
node_version_raw="$(node -v | sed 's/^v//')"
node_major="${node_version_raw%%.*}"
node_minor="$(echo "$node_version_raw" | cut -d. -f2)"
if [ "$node_major" -lt "$required_node_major" ] || { [ "$node_major" -eq "$required_node_major" ] && [ "$node_minor" -lt "$required_node_minor" ]; }; then
  cat <<EOF
Node.js $required_node_major.$required_node_minor or newer is required.
Detected: $node_version_raw
If you use nvm, run:
  nvm install 22.12.0
  nvm use 22.12.0
EOF
  exit 1
fi

if [ ! -f "$ROOT_DIR/.env.local" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env.local"
    echo "Created .env.local from .env.example"
  else
    cat > "$ROOT_DIR/.env.local" <<'EOF'
CONVEX_URL=
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# FIRECRAWL_API_KEY=
# GOOGLE_GENERATIVE_AI_API_KEY=
# OPENROUTER_API_KEY=
# XAI_API_KEY=
EOF
    echo "Created .env.local (fill in values)"
  fi
fi

if [ ! -e "$ROOT_DIR/.env" ]; then
  ln -s .env.local "$ROOT_DIR/.env"
  echo "Linked .env -> .env.local"
fi

echo "Installing JS dependencies..."
bun install

echo "Syncing Python dependencies..."
(
  cd "$ROOT_DIR/apps/analysis"
  uv sync
)

echo "Setup complete."
echo
echo "Next steps:"
echo "  1. Fill in .env.local"
echo "  2. Create/link a Convex dev deployment for apps/engine-convex"
echo "  3. Create a Railway Temporal project from the official template"
echo "  4. Add a Redis service to that Railway project"
echo "  5. Link this repo to that Railway project"
echo "  6. Run scripts/deploy_railway_worker.sh to deploy the Railway worker"
echo "  7. Set Convex TEMPORAL_ADDRESS to the public Railway TCP proxy"
echo "  8. Start local UI + Convex surfaces with: bun dev"
echo
echo "Detailed instructions live in docs/setup.md"
