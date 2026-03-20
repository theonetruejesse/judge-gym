# engine-temporal

Temporal worker package for judge-gym. It now contains the first greenfield rewrite skeleton for Temporal-owned process execution:

- `RunWorkflow` with the canonical run stages (`rubric_gen`, `rubric_critic`, `score_gen`, `score_critic`)
- `WindowWorkflow` with the canonical window stages (`collect`, `l1_cleaned`, `l2_neutralized`, `l3_abstracted`)
- shared process control handlers for `pause_after`, `pause_now`, `resume`, and bounded repair placeholders
- a dual-worker entrypoint that listens on separate run/window task queues
- a local test harness helper that caches the Temporal CLI under `packages/engine-temporal/.temporal/test-server-downloads`
- the first Upstash quota/runtime scaffolding for worker-side rate limiting

The current code is still scaffolding. Activities only project process state and return placeholder stage summaries; the Convex worker API, artifact writes, provider adapters, and real quota settlement logic have not been wired yet.

Use `bun install` from the repo root for dependency installation. The package executes on Node, but it is still managed through the Bun workspace. For now, the repo root `.env.local` is the source of truth for runtime configuration; package-local env files are optional convenience copies, not the authoritative config.

## Running it

1. Install repo dependencies with `bun install` from the repo root.
1. Run `bun dev` from the repo root to start the Temporal server and worker with the rest of the monorepo.
1. In another shell, run `bun run workflow -- run my-run-id` from `packages/engine-temporal` to start a run workflow, or `bun run workflow -- window my-window-id` to start a window workflow.

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

- Root `.env.local` is the authoritative env file for `bun dev` and the direct package scripts.
- `TEMPORAL_ADDRESS` defaults to `localhost:7233`
- `TEMPORAL_NAMESPACE` defaults to `default`
- `TEMPORAL_RUN_TASK_QUEUE` defaults to `judge-gym.run`
- `TEMPORAL_WINDOW_TASK_QUEUE` defaults to `judge-gym.window`
- `TEMPORAL_TASK_QUEUE` can still be used as a shared fallback for both queues during local setup
- `TEMPORAL_RETRY_DELAY_MS` defaults to `5000` for the dev worker retry loop
- `TEMPORAL_TEST_SERVER_MODE=existing` can be used to point tests at an already-running local Temporal server instead of spawning an ephemeral one
- `TEMPORAL_TEST_SERVER_DOWNLOAD_DIR` can override the default in-repo CLI cache directory used by the local test harness
- `TEMPORAL_TEST_SERVER_EXECUTABLE` can point tests at a preinstalled Temporal CLI binary
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are now the worker-side quota env vars
