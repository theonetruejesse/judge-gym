# Railway

This repo treats Railway as the canonical Temporal runtime and external acquisition plane:

- Railway template services run the Temporal cluster
- Railway `engine-temporal-worker` runs the worker code from this repo, including Media Cloud acquisition
- local `bun dev` does **not** start a local Temporal cluster or local worker

## Canonical split

- `railway.toml`
  Build/deploy config-as-code for the worker service
- `Dockerfile`
  Worker container build/runtime definition
- `scripts/deploy_railway_worker.sh`
  Idempotent worker service create/deploy/env-sync helper
- `scripts/verify_railway_worker.sh`
  Fast preflight that auto-links the Railway project and confirms the worker service target exists

## Current recommended bootstrap

1. Create a Railway project from the official Temporal template:

   ```text
   https://railway.com/deploy/temporal-workflow-engine
   ```

2. Add a Redis service to the same Railway project
3. Add a public TCP proxy to the Temporal frontend service on port `7233`
4. Put that public `host:port` into:
   - root `.env.local` `TEMPORAL_ADDRESS`
   - Convex env `TEMPORAL_ADDRESS`
5. Put these in `.env.local`:

   ```bash
   RAILWAY_PROJECT_ID=<your-railway-project-id>
   RAILWAY_ENVIRONMENT=production
   RAILWAY_WORKER_SERVICE_NAME=engine-temporal-worker
   ```

6. Verify the Railway link/bootstrap:

   ```bash
   ./scripts/verify_railway_worker.sh
   ```

7. Deploy the worker:

   ```bash
   ./scripts/deploy_railway_worker.sh
   ```

## Worker private address

The deploy script defaults to:

```bash
RAILWAY_TEMPORAL_PRIVATE_ADDRESS=temporalserver.railway.internal:7233
```

That matches the current Railway Temporal template private domain exposed by the
`temporal_server` service. If your project uses a different private service
naming, override
`RAILWAY_TEMPORAL_PRIVATE_ADDRESS` in `.env.local` before running the deploy
script.

The deploy script also defaults the worker Redis connection to:

```bash
RAILWAY_REDIS_URL_REFERENCE=${{Redis.REDIS_URL}}
```

If your Railway Redis service uses a different service name or variable
reference, override `RAILWAY_REDIS_URL_REFERENCE` in `.env.local`.

The worker also requires:

```bash
MEDIACLOUD_API_KEY=...
```

because Media Cloud discovery now runs inside `engine-temporal` rather than in Convex actions.

For the current wave, the worker deploy intentionally syncs only the provider/runtime keys
that are on the active execution path:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY` when present
- `OPENROUTER_API_KEY` when present
- `MEDIACLOUD_API_KEY`
- `CONVEX_URL`
- `TEMPORAL_*`
- `REDIS_*`
- optional Axiom telemetry keys

## Publishing your own project template

Once the project topology is stable, the intended maintainer path is:

1. stand up a working Railway project from the official Temporal template
2. deploy `engine-temporal-worker` from this repo into that project
3. verify env + networking once
4. publish **that whole project** as your own Railway template

That gives contributors the simplest flow:

- click your template
- fill envs
- configure Convex
- run `./scripts/deploy_railway_worker.sh`
- run `bun dev`

Until that custom template exists, the supported path remains:
official Temporal template + `./scripts/deploy_railway_worker.sh`.
