# engine-temporal

Temporal worker package for the greenfield V4 runtime.

## What Runs Here

Three workflows are live:

- `RunWorkflow`
- `EvidenceAcquisitionWorkflow`
- `EvidenceTransformWorkflow`

Run stages:

- `rubric_gen`
- `rubric_critic`
- `score_gen`
- `score_critic`

Evidence acquisition covers:

- Media Cloud page discovery
- URL hydration and raw source persistence

Evidence transform stages:

- `l1_cleaned`
- `l2_neutralized`
- `l3_abstracted`

The worker executes provider-routed LLM calls, native batch flows, quota enforcement, Media Cloud acquisition, run workflow snapshot/control handling, and semantic evidence view generation.

## Provider Support

- OpenAI direct + native batch
- Anthropic direct + native batch
- OpenRouter direct

## Main Files

- `src/workflows.ts`: `RunWorkflow`, `EvidenceAcquisitionWorkflow`, and `EvidenceTransformWorkflow`
- `src/activities.ts`: activity bindings
- `src/evidence_acquisition/`: Media Cloud discovery + URL hydration
- `src/run/service.ts`: run-stage execution
- `src/evidence_transform/service.ts`: semantic transform execution
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
- `MEDIACLOUD_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`

## Notes

- The worker is V4-only; the old window task queue and window activity path are removed.
- The primary deployment target is Railway.
