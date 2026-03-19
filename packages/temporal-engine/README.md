# temporal-engine

Temporal worker package for judge-gym. It currently contains the scaffolded hello-world workflow/activity pair and is wired into the repo workspace so root `bun dev` starts it alongside the other package dev processes and the local Temporal dev server.

## Running it

1. Install repo dependencies with `bun install` from the repo root.
1. Run `bun dev` from the repo root to start the Temporal server and worker with the rest of the monorepo.
1. In another shell, run `bun run workflow` from `packages/temporal-engine` to execute the sample workflow client.

The Workflow should return:

```bash
Hello, Temporal!
```

## Environment

- `TEMPORAL_ADDRESS` defaults to `localhost:7233`
- `TEMPORAL_NAMESPACE` defaults to `default`
- `TEMPORAL_TASK_QUEUE` defaults to `hello-world`
- `TEMPORAL_RETRY_DELAY_MS` defaults to `5000` for the dev worker retry loop
