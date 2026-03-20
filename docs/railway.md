# Railway

This repo treats Railway as the canonical Temporal runtime:

- Railway template services run the Temporal cluster
- Railway `engine-temporal-worker` runs the worker code from this repo
- local `bun dev` does **not** start a local Temporal cluster or local worker

## Canonical split

- `railway.toml`
  Build/deploy config-as-code for the worker service
- `Dockerfile`
  Worker container build/runtime definition
- `scripts/deploy_railway_worker.sh`
  Idempotent worker service create/deploy/env-sync helper

## Current recommended bootstrap

1. Create a Railway project from the official Temporal template:

   ```text
   https://railway.com/deploy/temporal-workflow-engine
   ```

2. Add a public TCP proxy to the Temporal frontend service on port `7233`
3. Put that public `host:port` into:
   - root `.env.local` `TEMPORAL_ADDRESS`
   - Convex env `TEMPORAL_ADDRESS`
4. Link the repo locally:

   ```bash
   railway link --project <project-id> --environment production
   ```

5. Deploy the worker:

   ```bash
   ./scripts/deploy_railway_worker.sh
   ```

## Worker private address

The deploy script defaults to:

```bash
RAILWAY_TEMPORAL_PRIVATE_ADDRESS=temporal-frontend:7233
```

That matches the current official Railway Temporal template. If your project
uses a different private service name, override
`RAILWAY_TEMPORAL_PRIVATE_ADDRESS` in `.env.local` before running the deploy
script.

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
- run `bun dev`

Until that custom template exists, the supported path remains:
official Temporal template + `./scripts/deploy_railway_worker.sh`.
