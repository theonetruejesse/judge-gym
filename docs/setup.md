# Setup

This repo now uses a Railway-first Temporal setup:

- local machine: Bun workspace, Next.js lab UI, Convex dev tooling
- Railway: Temporal cluster and `engine-temporal` worker
- Convex cloud: engine state, APIs, and workflow start hooks

The goal is a setup path that another contributor can reproduce without inheriting a
machine-specific Railway link or local Temporal server.

## Prerequisites

- Node.js `>=22.12.0`
- Bun `>=1.1.27`
- uv
- Convex CLI
- Railway CLI

## 1. Install repo dependencies

```bash
./scripts/setup.sh
```

That script:

- checks the required CLIs
- creates `.env.local` from `.env.example` if needed
- runs `bun install`
- runs `uv sync` in `packages/analysis`

## 2. Fill in `.env.local`

Use `.env.example` as the template. The minimum local values are:

```bash
CONVEX_DEPLOYMENT=...
CONVEX_URL=...
CONVEX_SITE_URL=...

OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

TEMPORAL_ADDRESS=<public temporal frontend tcp host:port>
TEMPORAL_NAMESPACE=default
```

Notes:

- Local scripts use the public Temporal TCP endpoint.
- The Railway worker does **not** use that public endpoint. It uses the private
  Railway alias `temporal-frontend:7233` unless your template used a different
  private service name.

## 3. Create the Railway Temporal project

Create a fresh Railway project from the official Temporal template:

```text
https://railway.com/deploy/temporal-workflow-engine
```

That project should contain the Temporal cluster services. Depending on the
template version, the service names may vary a little, but you should end up
with a Temporal frontend service plus the supporting history/matching/database
services.

For the current official template, the private worker address is typically:

```bash
RAILWAY_TEMPORAL_PRIVATE_ADDRESS=temporal-frontend:7233
```

If your template uses different private service naming, override
`RAILWAY_TEMPORAL_PRIVATE_ADDRESS` in `.env.local` before running the deploy
script.

Add a public TCP proxy on the Temporal frontend service targeting port `7233`.

That public `host:port` is the value used by:

- local `.env.local` `TEMPORAL_ADDRESS`
- Convex deployment env `TEMPORAL_ADDRESS`

The Railway worker does **not** use that public address. It stays on the
private Railway network.

## 4. Link your repo to Railway

Link this repo to the Railway project you want to use:

```bash
railway link --project <project-id> --environment production
```

Do this locally only. Do not commit machine-specific Railway link state.

## 5. Deploy the Railway worker

Deploy the `engine-temporal` worker service from the repo root:

```bash
./scripts/deploy_railway_worker.sh
```

That script:

- creates `engine-temporal-worker` if it does not exist
- deploys using the repo-root `railway.toml` plus the repo-root `Dockerfile`
- syncs the worker env vars from `.env.local`
- defaults the worker to `temporal-frontend:7233` internally

The worker service needs:

- `TEMPORAL_ADDRESS=temporal-frontend:7233`
- `TEMPORAL_NAMESPACE=default`
- `CONVEX_URL`
- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional:

- `AXIOM_DATASET`
- `AXIOM_TOKEN`
- additional provider API keys

## 6. Configure Convex env

Convex needs the **public** Temporal address, not the Railway private one:

```bash
TEMPORAL_ADDRESS=<public temporal frontend tcp host:port>
TEMPORAL_NAMESPACE=default
OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

If you use telemetry in Convex:

```bash
AXIOM_DATASET=judge-gym
AXIOM_TOKEN=...
```

## 7. Run the local surfaces

```bash
bun dev
```

This starts only:

- `packages/engine-convex`
- `packages/lab`

The Temporal cluster and the Temporal worker should already be running on Railway.

## 8. Verify the stack

Recommended smoke test:

1. create a small window in the lab UI
2. confirm the window gets a `workflow_id`
3. confirm evidence rows appear
4. check Railway worker logs for `judge-gym.window` polling
5. use `packages/codex:getProcessHealth` to confirm stage progress

## Deployment model

- local dev: UI + Convex tooling
- Railway Temporal template: Temporal cluster
- Railway `engine-temporal-worker`: worker runtime
- Convex cloud: workflow starts and persistent state

That is the supported path going forward.

## Maintainer note: making this truly one-click

The clean end state is:

1. keep `railway.toml` + `Dockerfile` in this repo as the canonical worker
   deployment config
2. create a Railway project from the official Temporal template
3. deploy `engine-temporal-worker` into that project
4. once that project shape is stable, publish **your own Railway template**
   from the working project so contributors can deploy the full Temporal side in
   one click

Until that custom template exists, the supported contributor flow is:
official Temporal template first, then `./scripts/deploy_railway_worker.sh`.
