# Final State — Deep Search Overhaul (Refactor Everything)

Last updated: 2026-02-13

This document captures the end-state of the refactor: what changed, why it changed, and where the new architecture lives.

## Why This Re-Architecture

The overhaul was meant to make LLM batching reliable and auditable, make run policies enforceable server-side, and make the codebase navigable without losing stage-level context. The main goals were:

1. **Ledger-first batching**: normalize all LLM calls into request/batch/message tables so retries and audits are first-class.
2. **Policy-driven orchestration**: run policies live on the `runs` table and are enforced by Convex workflows.
3. **Separation of concerns**: split “domain logic” (experiments, runs, llm_calls) from “platform” infrastructure (providers, rate limiting, utilities).
4. **Stage locality**: prompts/parsers/workflows stay grouped by stage within the experiments domain.
5. **Clean public surface**: all engine exports flow through `packages/engine/src/index.ts`.

## Final Architecture (Current Layout)

### Domain surface (Convex)
- `packages/engine/convex/domain/experiments/`
  - `stages/{evidence,rubric,scoring}/` — stage-local prompts/parsers/workflows
  - `entrypoints.ts` — public experiment entrypoints
  - `repo.ts` — experiment data helpers
  - `strategies/*` — scoring/randomization/ordering strategies
- `packages/engine/convex/domain/runs/`
  - `entrypoints.ts` — public run entrypoints
  - `repo.ts` — run data helpers
  - `workflows/run_state.ts` — run stage accounting
- `packages/engine/convex/domain/llm_calls/`
  - `llm_requests.ts`, `llm_batches.ts`, `llm_messages.ts`
  - `workflows/` — `batch_queue`, `batch_submit`, `batch_poll`, `batch_finalize`
  - `workflows/*_logic.ts` — pure logic helpers for testability

### Platform surface (Convex)
- `packages/engine/convex/platform/providers/` — OpenAI + Anthropic batch adapters (Gemini stubbed)
- `packages/engine/convex/platform/rate_limiter/`
- `packages/engine/convex/platform/utils/` — zod helpers, model/provider mapping, batch registry

### Schema + models
- `packages/engine/convex/models/*.ts` — `core`, `experiments`, `runs`, `llm_calls`
- `packages/engine/convex/schema.ts` — schema assembly

### Lab package
- `packages/lab/` — Ink TUI + supervisor loop; sends policy to engine and drives batches

### Engine exports
- `packages/engine/src/index.ts` — sole export surface for other packages

## What’s Now Enforced Server-Side

1. **Run policy on `runs.policy`** (see `models/core.ts` + `models/runs.ts`).
2. **Batch queue gating** uses policy:
   - max batch size
   - provider/model gating
   - max new batches per tick
3. **Rate limiting** enforced in submit path.
4. **Batch retry policy** (max retries + backoff) handled in polling/finalization.

## Tests Added / Updated

New coverage was added for pure logic helpers and integration layers:

- `packages/engine/tests/batch_queue_logic.test.ts`
- `packages/engine/tests/batch_poll_retry_logic.test.ts`
- `packages/engine/tests/run_state_logic.test.ts`
- `packages/engine/tests/integration_openai_batch.test.ts` (real OpenAI, guarded by env)

Existing tests were ported to the new structure:

- parsers, prompts, strategies, rate limiter, and readonly Convex API tests.

## What Changed vs. Main Branch

- **Stage-first layout** was replaced by **domain-first + stage-local** grouping.
- Legacy orchestration (`workflow_manager.ts`) was removed.
- The LLM call path is now **ledger-driven** (`llm_requests` → `llm_batches` → `llm_messages`).
- The engine package no longer exposes scattered helpers; everything exports from `src/index.ts`.
- Lab is now the orchestration client (supervisor loop) and is responsible for run creation / batch ticks.

## Known Gaps / Follow-ups

1. **Gemini batch adapter** remains a stub until Vertex integration is finalized.
2. **OpenAI integration test** requires outbound network + `OPENAI_API_KEY`.
3. **Turbo typecheck** still crashes; root `typecheck` uses direct `tsc`.

