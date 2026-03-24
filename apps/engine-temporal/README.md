# engine-temporal

Temporal worker package for the greenfield V4 runtime.

## What Runs Here

Only `RunWorkflow` is live.

Stages:

- `rubric_gen`
- `rubric_critic`
- `score_gen`
- `score_critic`

The worker executes provider-routed LLM calls, native batch flows, quota enforcement, and workflow snapshot/control handling.

## Provider Support

- OpenAI direct + native batch
- Anthropic direct + native batch
- OpenRouter direct

## Main Files

- `src/workflows.ts`: `RunWorkflow`
- `src/activities.ts`: activity bindings
- `src/run/service.ts`: run-stage execution
- `src/llm/`: provider clients
- `src/convex/client.ts`: worker-side Convex API client
- `src/quota/`: Redis-backed quota logic

## Commands

- `bun run workflow -- run <run_id>`
- `bun run test`
- `bun run typecheck`

## Environment

- `TEMPORAL_ADDRESS`
- `TEMPORAL_NAMESPACE`
- `TEMPORAL_TLS_ENABLED`
- `TEMPORAL_TLS_SERVER_NAME`
- `TEMPORAL_RUN_TASK_QUEUE` default: `judge-gym.run`
- `REDIS_URL`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`

## Notes

- The worker is run-only; the old window task queue and window activity path are removed.
- The primary deployment target is Railway.
