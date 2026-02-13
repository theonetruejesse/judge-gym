# judge-gym — ASCII Architecture Diagrams

These diagrams map the current system and point to the concrete files that implement each step.

## Monorepo layout (high-level)

```
judge-gym/
  packages/
    engine/                         <-- Convex backend + shared types
      convex/
        schema.ts                   <-- defineSchema + indexes
        models/                     <-- table schemas + shared types
          core.ts                   <-- core enums/types + RunPolicy
          experiments.ts            <-- experiments/windows/evidences/rubrics/samples/scores
          runs.ts                   <-- runs + run_stages
          llm_calls.ts              <-- llm_requests/llm_batches/llm_batch_items/llm_messages
        workflows/                  <-- orchestration (batching, parsing, run state)
        llm_calls/                  <-- llm request/batch/messaging data access
        providers/                  <-- batch adapters (OpenAI, Anthropic)
        rate_limiter/               <-- provider rate limiter helpers
        utils/                       <-- zod helpers, model/provider map, batch registry
      src/index.ts                   <-- engine exports used by other packages
    lab/                             <-- supervisor + run control
      src/supervisor.ts              <-- batch submit/poll loop
      src/helpers/clients.ts         <-- Convex clients + api import
      src/run_policy.ts              <-- lab-side policy config
    analysis/                        <-- Python/uv analysis
  _blueprints/deep-search-overhaul/  <-- planning + diagrams + save-state
```

## Models -> Schema (data model wiring)

```
models/core.ts
  - enums/types (ModelType, Provider, LlmStage, RunPolicy)
  - DEFAULT_RUN_POLICY

models/experiments.ts
  - Experiments/Windows/Evidences/Rubrics/Samples/Scores

models/runs.ts
  - Runs/RunStages

models/llm_calls.ts
  - LlmRequests/LlmBatches/LlmBatchItems/LlmMessages

                (imports table schemas)
models/*  ------------------------------------->  schema.ts
                                                   defineSchema({ tables + indexes })
```

Files:

- `packages/engine/convex/models/core.ts`
- `packages/engine/convex/models/experiments.ts`
- `packages/engine/convex/models/runs.ts`
- `packages/engine/convex/models/llm_calls.ts`
- `packages/engine/convex/schema.ts`

## Exports used by other packages

```
engine/src/index.ts
  - export * from convex/models/*
  - export { api, internal } from convex/_generated/api
  - export type { Doc, Id } from convex/_generated/dataModel

lab/src/*
  - imports types/schemas from @judge-gym/engine
  - uses api from @judge-gym/engine
```

Files:

- `packages/engine/src/index.ts`
- `packages/lab/src/helpers/clients.ts`
- `packages/lab/src/supervisor.ts`

## Run lifecycle + LLM batching (control flow)

```
User / tooling
  |
  |  (create run)
  v
convex/main.ts:createRun
  |
  |  (seed requests)
  v
convex/workflows/seed_requests.ts
  |
  |  (queued requests)
  v
llm_requests table (models/llm_calls.ts)
  |
  |  (batch creation + gating)
  v
convex/workflows/batch_queue.ts
  |
  |  (submit batch)
  v
convex/workflows/batch_submit.ts  ---> providers/* (OpenAI/Anthropic batch adapters)
  |
  |  (poll status)
  v
convex/workflows/batch_poll.ts
  |
  |  (apply results)
  v
convex/workflows/batch_finalize.ts
  |
  |  (parse + update domain tables)
  v
convex/workflows/parser_gate.ts  ---> updates rubrics/scores tables
  |
  |  (stage state)
  v
convex/workflows/run_state.ts    ---> updates runs + run_stages
```

Files:

- `packages/engine/convex/main.ts`
- `packages/engine/convex/workflows/seed_requests.ts`
- `packages/engine/convex/workflows/batch_queue.ts`
- `packages/engine/convex/workflows/batch_submit.ts`
- `packages/engine/convex/workflows/batch_poll.ts`
- `packages/engine/convex/workflows/batch_finalize.ts`
- `packages/engine/convex/workflows/parser_gate.ts`
- `packages/engine/convex/workflows/run_state.ts`
- `packages/engine/convex/providers/openai_batch.ts`
- `packages/engine/convex/providers/anthropic_batch.ts`

## Run policy + rate limiting (server-side enforcement)

```
Run policy source
  runs.policy (models/runs.ts)     DEFAULT_RUN_POLICY (models/core.ts)
          |                                    |
          +---------------------+--------------+
                                |
                                v
                         batch_queue.ts
                       - provider/model gating
                       - max_batch_size cap
                       - stage/desired_state gating
                                |
                                v
                         batch_submit.ts
                       - provider/model gating
                       - max_batch_size guard
                       - rate_limiter checks
                                |
                                v
                          batch_poll.ts
                       - poll_interval_ms
                       - retry_backoff_ms
```

Files:

- `packages/engine/convex/models/core.ts`
- `packages/engine/convex/models/runs.ts`
- `packages/engine/convex/workflows/batch_queue.ts`
- `packages/engine/convex/workflows/batch_submit.ts`
- `packages/engine/convex/workflows/batch_poll.ts`
- `packages/engine/convex/rate_limiter/*`

## LLM calls data model (tables + relationships)

```
llm_requests (stage/provider/model, prompts, status, retry)
   | 1..*
   | creates
   v
llm_batch_items (batch_id + request_id + status)
   ^
   | *..1
llm_batches (provider/model/batch_ref/status)

llm_requests  --(result_message_id)--> llm_messages

runs --(run_id)--> llm_batches (optional linkage for policy + attribution)
```

Files:

- `packages/engine/convex/models/llm_calls.ts`
- `packages/engine/convex/llm_calls/llm_requests.ts`
- `packages/engine/convex/llm_calls/llm_batches.ts`
- `packages/engine/convex/llm_calls/llm_messages.ts`

## Lab supervisor tick (client-side scheduling)

```
LabSupervisor.tick()
  |
  |  listBatchesDueForPolling(now)
  v
convex/lab.ts:listBatchesDueForPolling
  -> internal.llm_calls.llm_batches.listBatchesDueForPolling

  (for each batch)
  |  pollBatch(batch_id, provider)
  v
convex/lab.ts:pollBatch
  -> internal.workflows.batch_poll

  (create + submit batches)
  |  createBatchFromQueued(provider, model, max_items)
  v
convex/lab.ts:createBatchFromQueued
  -> internal.workflows.batch_queue

  |  submitBatch(batch_id, provider)
  v
convex/lab.ts:submitBatch
  -> internal.workflows.batch_submit
```

Files:

- `packages/lab/src/supervisor.ts`
- `packages/engine/convex/lab.ts`
- `packages/engine/convex/workflows/batch_queue.ts`
- `packages/engine/convex/workflows/batch_submit.ts`
- `packages/engine/convex/workflows/batch_poll.ts`

## Current vs Target (chosen: domain-first + stage locality)

```
Current (refactor-everything):
convex/
  models/
  workflows/
  llm_calls/
  providers/
  rate_limiter/
  prompts/
  parsers/
  strategies/
  lab.ts

Target (domain-first + stage locality):
convex/
  domain/
    experiments/
      repo.ts
      workflows/
      stages/
        evidence/    (prompts + parsers + stage workflows)
        rubric/      (prompts + parsers + stage workflows)
        scoring/     (prompts + parsers + stage workflows)
      strategies/    (if still tightly coupled to experiments)
    runs/
      repo.ts
      workflows/
    llm_calls/
      repo.ts
      workflows/
  platform/
    providers/
    rate_limiter/
    utils/
  models/
  schema.ts
  lab.ts
```

## Target tree (Option 1)

```
packages/engine/convex/
  domain/
    experiments/
      repo.ts
      workflows/
        seed_requests.ts
        parser_gate.ts
        run_state.ts
      stages/
        evidence/
          prompts/
          parsers/
          workflows/
        rubric/
          prompts/
          parsers/
          workflows/
        scoring/
          prompts/
          parsers/
          workflows/
      strategies/
    runs/
      repo.ts
      workflows/
    llm_calls/
      repo.ts
      workflows/
  platform/
    providers/
      openai_batch.ts
      anthropic_batch.ts
      gemini_batch.ts (stubbed)
    rate_limiter/
    utils/
  models/
  schema.ts
  lab.ts
```

## Migration map (from current layout)

1. Move stage assets into `domain/experiments/stages/*`.
2. Move experiment-specific workflows into `domain/experiments/workflows/`.
3. Move run workflows into `domain/runs/workflows/`.
4. Move LLM call workflows into `domain/llm_calls/workflows/`.
5. Move providers, rate limiter, and shared helpers into `platform/*`.
6. Keep `models/` + `schema.ts` at root for Convex schema wiring.
7. Update all imports to the new paths (no behavioral changes).

## Stage discovery map (after reorg)

```
Looking for rubric behavior?

domain/experiments/
  stages/rubric/
    prompts/      <-- prompt templates
    parsers/      <-- rubric parsing + validation
    workflows/    <-- rubric-specific enqueue/parse steps
  workflows/      <-- run-wide orchestration (non-stage-specific)
  repo.ts         <-- experiment/rubric CRUD helpers
```

```
Looking for scoring behavior?

domain/experiments/
  stages/scoring/
    prompts/
    parsers/
    workflows/
  workflows/
  repo.ts
```

```
Looking for batching + providers?

domain/llm_calls/
  workflows/      <-- batch_queue/batch_submit/batch_poll/batch_finalize
  repo.ts         <-- llm_requests/llm_batches accessors
platform/
  providers/      <-- OpenAI/Anthropic batch adapters
  rate_limiter/   <-- provider rate limits
  utils/          <-- zod helpers, model/provider map, batch registry
```
