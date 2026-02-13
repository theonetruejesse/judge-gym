# Save State — Deep Search Overhaul (Refactor Everything)

Last updated: 2026-02-13

This document captures the current implementation state, the structure of this folder, and how to resume work without re-reading everything.

## Where We Are

The refactor is mid-flight but fully wired for the new batching/ledger architecture. Core Convex schema + workflows have been replaced, batching is end-to-end for OpenAI + Anthropic (Gemini stub), and a new `lab` package with an Ink TUI + supervisor loop has been added. The old engine runner was removed and moved into the new lab package.

Turbo `bun run typecheck` continues to crash (Turbo issue). The repo `typecheck` script now runs `tsc` directly and passes (`typecheck:broken` points to Turbo).

## Folder Guide

`_blueprints/deep-search-overhaul/`
1. `plan-v0.md`
   - The source-of-truth blueprint for the refactor, architecture, schema, workflows, and deletion plan.
2. `save-state.md`
   - This file; continuation guide.

## Current Code State (Highlights)

### Convex schema + ledger
1. Schema split into models + assembly:
   - `packages/engine/convex/models/core.ts`
   - `packages/engine/convex/models/experiments.ts`
   - `packages/engine/convex/models/runs.ts`
   - `packages/engine/convex/models/llm_calls.ts`
   - `packages/engine/convex/schema.ts` (assembly + re-exports)
2. LLM ledger + batch modules moved under `llm_calls/`:
   - `packages/engine/convex/llm_calls/llm_requests.ts`
   - `packages/engine/convex/llm_calls/llm_messages.ts`
   - `packages/engine/convex/llm_calls/llm_batches.ts`
3. Run policy now includes retry knobs (`max_batch_retries`, `retry_backoff_ms`) and requests track `next_retry_at`.

### Provider batching
1. Adapters:
   - `packages/engine/convex/providers/openai_batch.ts`
   - `packages/engine/convex/providers/anthropic_batch.ts`
   - `packages/engine/convex/providers/gemini_batch.ts` (stub)
2. Registry:
   - `packages/engine/convex/utils/batch_registry.ts`
   - `packages/engine/convex/batch_adapter_registry.ts`

### Batching workflows + parsing
1. Batching:
   - `packages/engine/convex/workflows/batch_queue.ts`
   - `packages/engine/convex/workflows/batch_submit.ts`
   - `packages/engine/convex/workflows/batch_poll.ts`
   - `packages/engine/convex/workflows/batch_finalize.ts`
   - Run policy enforcement + batch retry logic live here.
2. Parsing/gating:
   - `packages/engine/convex/workflows/parser_gate.ts`
3. Run state:
   - `packages/engine/convex/workflows/run_state.ts`

### Lab orchestration (public Convex endpoints)
1. Lab API:
   - `packages/engine/convex/lab.ts`
   - exposes batch submission, polling, queue stats, runs list

### Lab package (Ink TUI + supervisor)
1. New package:
   - `packages/lab/`
2. TUI + supervisor:
   - `packages/lab/src/index.tsx`
   - `packages/lab/src/supervisor.ts`
3. Settings + helpers:
   - `packages/lab/src/experiments.ts`
   - `packages/lab/src/helpers/*`
4. Lab runs via `bun run lab` (root script uses `start`), `packages/lab` only has `start`.
5. Run policy config lives in `packages/lab/src/run_policy.ts` and is sent to the engine on `createRun`.

### Engine runner removed
1. Deleted legacy engine runner
2. Engine package now only runs Convex:
   - `packages/engine/package.json` (`dev: convex dev`)

### Tooling + env wiring updates
1. Convex helpers switched to `convex-helpers/server/zod4` after upgrading to `zod@4`.
2. Repo root `typecheck` script runs direct `tsc` for engine + lab; Turbo version is `typecheck:broken`.
3. Setup script added: `scripts/setup.sh` (creates `.env.local`, symlinks `.env`).
4. `.env.example` added for quick onboarding.
5. Lab no longer exposes a `dev` script; use `bun run lab` (root) or `bun run start` in `packages/lab`.
6. Run policy stored on `runs` table (`RunPolicySchema` in `packages/engine/convex/models/core.ts`).
7. Engine package exports consolidated through `packages/engine/src/index.ts` (including Convex `api` + `internal`).

## Known Gaps / TODO

1. Gemini batch adapter is still a stub (disabled in registry + schema for now).
   - Requires Vertex AI batch integration details (project, region, output).
2. Turbo typecheck crash persists.
   - Repo script bypasses Turbo; decide whether to upgrade Turbo or keep bypass.
3. Convex codegen needs refresh after schema changes.
   - Regenerate via `convex dev` (already running on your side).

## How to Continue

### 1) Verify Typecheck (root)
```bash
bun run typecheck
```

### 2) Convex dev is required to regenerate API + data model
Ensure `convex dev` is running in `packages/engine` and uses the repo root `.env.local` (symlinked by `.env`).

### 3) Run the lab TUI
```bash
bun run lab
```
Optional:
```bash
LAB_BOOTSTRAP=1 NEW_RUN=1 bun run lab
```

### 4) Next implementation steps
1. Implement Gemini batch adapter.
2. If needed, move remaining analysis export or evidence collection logic into workflows.

## Commit Breakout (Suggested)

1. **convex(schema+ledger): snake_case schema + llm ledger tables**
   - `packages/engine/convex/schema.ts`
   - `packages/engine/convex/models/*`
   - `packages/engine/convex/llm_calls/*`
   - `packages/engine/convex/data.ts`, `convex/repo.ts`

2. **convex(workflows): batch orchestration + parser gate**
   - `packages/engine/convex/workflows/*`
   - `packages/engine/convex/parsers/*`
   - `packages/engine/convex/prompts/*`

3. **convex(providers): batch adapters + registry + rate limit accounting**
   - `packages/engine/convex/providers/*`
   - `packages/engine/convex/batch_adapter_registry.ts`
   - `packages/engine/convex/rate_limiter/*`

4. **convex(lab): public lab endpoints**
   - `packages/engine/convex/lab.ts`
   - `packages/engine/convex/utils.ts` (zAction)

5. **lab(tui): add lab package + supervisor**
   - `packages/lab/*`
   - `package.json` (root scripts)

6. **engine(cleanup): remove legacy runner**
   - delete `packages/engine/src/*`
   - update `packages/engine/package.json`

7. **analysis+tests: update analysis exports + tests**
   - `packages/analysis/src/judge_gym/collect.py`
   - `packages/engine/tests/*`

## Notes

- This branch is `refactor-everything`.
- Convex URL is expected in root `.env.local`.
- New lab orchestration drives batching; engine no longer owns the runner.
