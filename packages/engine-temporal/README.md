# engine-temporal

Temporal worker package for judge-gym. It now contains the greenfield Temporal-owned process runtime:

- `RunWorkflow` with the canonical run stages (`rubric_gen`, `rubric_critic`, `score_gen`, `score_critic`)
- `WindowWorkflow` with the canonical window stages (`collect`, `l1_cleaned`, `l2_neutralized`, `l3_abstracted`)
- shared process control handlers for `pause_after`, `pause_now`, `resume`, and bounded repair placeholders
- a dual-worker entrypoint that listens on separate run/window task queues
- a local test harness helper that caches the Temporal CLI under `packages/engine-temporal/.temporal/test-server-downloads`
- the live Redis quota/runtime layer for worker-side rate limiting on OpenAI chat paths

The current code is in a mixed state:

- the window path is live and calls Firecrawl + OpenAI through `src/window/service.ts`, with Convex worker-API writes for workflow binding, evidence insertion, attempt logging, stage result application, and window-level error/completion projection
- the run path is also live and calls OpenAI through `src/run/service.ts`, with Convex worker-API writes for workflow binding, attempt logging, parsed artifact application, and stage finalization
- the worker now enforces provider/model token buckets through Redis before OpenAI chat calls, then settles those reservations after each attempt finishes

Use `bun install` from the repo root for dependency installation. The package executes on Node, but it is still managed through the Bun workspace. The repo root `.env.local` is the source of truth for local scripts, but the primary dev/runtime path is a Railway-hosted Temporal worker service.

## Running it

1. Install repo dependencies with `bun install` from the repo root.
1. Deploy the package to Railway using the repo-root `railway.toml` and repo-root `Dockerfile`.
1. Set the worker service env so `TEMPORAL_ADDRESS=temporal-frontend:7233` and `TEMPORAL_NAMESPACE=default`, unless your Railway Temporal template uses a different private frontend alias.
1. Use `bun run workflow -- run my-run-id` or `bun run workflow -- window my-window-id` from `packages/engine-temporal` only for direct client-side workflow operations when needed.

The workflow returns the final process snapshot after running all stages:

```bash
Started run workflow run:my-run-id
{
  processKind: "run",
  processId: "my-run-id",
  executionStatus: "completed",
  stageHistory: ["rubric_gen", "rubric_critic", "score_gen", "score_critic"],
  ...
}
```

## Environment

- Root `.env.local` is the authoritative env file for direct local package scripts.
- `TEMPORAL_ADDRESS` defaults to `localhost:7233` for local-only scripts; the Railway worker should use `temporal-frontend:7233` unless your template used a different private alias
- `TEMPORAL_NAMESPACE` defaults to `default`
- `TEMPORAL_TLS_ENABLED=1` enables TLS for the worker/client connection to Temporal
- `TEMPORAL_TLS_SERVER_NAME` optionally sets the TLS server-name override (useful for proxied frontends such as Railway TCP proxies)
- `TEMPORAL_RUN_TASK_QUEUE` defaults to `judge-gym.run`
- `TEMPORAL_WINDOW_TASK_QUEUE` defaults to `judge-gym.window`
- `TEMPORAL_RETRY_DELAY_MS` defaults to `5000` for the dev worker retry loop
- `TEMPORAL_TEST_SERVER_MODE=existing` can be used to point tests at an already-running local Temporal server instead of spawning an ephemeral one
- `TEMPORAL_TEST_SERVER_DOWNLOAD_DIR` can override the default in-repo CLI cache directory used by the local test harness
- `TEMPORAL_TEST_SERVER_EXECUTABLE` can point tests at a preinstalled Temporal CLI binary
- `REDIS_URL` is the primary worker-side quota env var; `REDIS_KEY_PREFIX` optionally overrides the quota key prefix

## Current implementation map

- `src/workflows.ts`: generic process workflow shell plus the current `windowWorkflow` / `runWorkflow`
- `src/window/service.ts`: live window activity implementation (collect + transform stages)
- `src/run/service.ts`: live run activity implementation (rubric + score stages)
- `src/convex/client.ts`: worker-side Convex HTTP client for the narrow worker API
- `src/quota/`: provider-aware Redis quota reservation/settlement layer
- `src/mocha/run-service.test.ts`: unit coverage for the run activity service
- `src/mocha/window-service.test.ts`: unit coverage for the window activity service
