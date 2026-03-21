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
- runs `uv sync` in `apps/analysis`

## 2. Fill in `.env.local`

Use `.env.example` as the template. The minimum local values are:

```bash
CONVEX_DEPLOYMENT=...
CONVEX_URL=...
CONVEX_SITE_URL=...

OPENAI_API_KEY=...
FIRECRAWL_API_KEY=...

TEMPORAL_ADDRESS=<public temporal frontend tcp host:port>
TEMPORAL_NAMESPACE=default
```

Notes:

- Local scripts use the public Temporal TCP endpoint.
- The Railway worker does **not** use that public endpoint. It uses the private
  Railway alias `temporalserver:7233` unless your template used a different
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

Add a Railway Redis service to the same project. The current deploy script
assumes the default Railway Redis service reference `${{Redis.REDIS_URL}}`.
If you rename the Redis service or use a different variable reference, override
`RAILWAY_REDIS_URL_REFERENCE` in `.env.local` before running the deploy script.

For the current official template, the private worker address is typically:

```bash
RAILWAY_TEMPORAL_PRIVATE_ADDRESS=temporalserver:7233
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
- defaults the worker to `temporalserver:7233` internally

The worker service needs:

- `TEMPORAL_ADDRESS=temporalserver:7233`
- `TEMPORAL_NAMESPACE=default`
- `CONVEX_URL`
- `OPENAI_API_KEY`
- `FIRECRAWL_API_KEY`
- `REDIS_URL` via the default Railway service reference `${{Redis.REDIS_URL}}`
  or your explicit `RAILWAY_REDIS_URL_REFERENCE`

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

- `apps/engine-convex`
- `apps/lab`

The Temporal cluster and the Temporal worker should already be running on Railway.

## 8. Verify the stack

Recommended smoke test:

```bash
bun run pilot:smoke
```

That smoke script:

1. checks Temporal queue readiness
2. creates a tiny window
3. waits for the window workflow to finish
4. creates a pool + experiment from the collected evidence
5. launches a one-sample run
6. waits for the run workflow to finish
7. prints a compact JSON summary with workflow ids, counts, and diagnostic totals

If the smoke fails, the first follow-up checks are:

1. Railway worker logs for `judge-gym.window` / `judge-gym.run`
2. `bun run debug:queues`
3. `bun run debug:inspect --window <window_id>` or `--run <run_id>`

## 9. Initialize the V3 cohort from a completed window run

Once you have a large evidence collection window run that finished successfully, create the shared pool plus the current manifest-selected V3 cohort with:

```bash
bun run v3:init -- --window-run-id <window_run_id> --pool-tag <pool_tag>
```

That command:

1. validates the machine-readable V3 matrix contract in the backend
2. creates one reusable pool from the completed `window_run`
3. materializes the manifest-selected V3 experiments against that pool
4. reuses existing matching bundle plans and experiment tags on repeated runs instead of creating duplicates

Pass `--all-experiments` if you want the full in-engine corrected matrix instead of the current manifest subset.

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
