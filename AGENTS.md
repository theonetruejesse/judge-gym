# judge-gym

An open-source LLM-as-Judge design space engine. Turborepo monorepo with bun (engine) and uv (analysis).

## Structure

- `packages/engine/convex/` — Convex backend (schema, jobs, agents, strategies)
- `packages/analysis/` — Python analysis (uv + Jupyter). DST, JSD, OLS.

## Convex Code Style

- Use zod-based helpers from `packages/engine/convex/utils.ts` (`zMutation`, `zQuery`, `zInternalAction`, etc.).
- Define `args` with zod + `zid(...)` and explicit `returns` validators.
- Prefer `internal.*` function references for cross-function calls.
- 2-space indent, semicolons, trailing commas.
- Use underscores (`_`) not hyphens (`-`) in all Convex filenames. Convex file-based routing does not support hyphens. Example: `rate_limiter.ts`, `job_scheduler.ts`, `verdict_parser.ts`.
- Schema first — check `convex/schema.ts` before writing any function.
- Reuse existing schemas and types wherever possible instead of redefining them.

## Guardrails

- Do not run `bun dev`, `npx convex dev`, or `uv run jupyter` unless explicitly instructed; assume they are already running.
- Do not run `npx convex codegen` unless explicitly instructed.
- Do not modify environment variables without explicit user approval.
- After any Convex code or schema changes, run the full validation routine:
  1. `bun run validate:convex` (root), or
  2. `cd packages/engine && npx convex codegen`, then `bun run typecheck` (root).
- Treat `npx convex codegen` + root `bun run typecheck` as one routine; do not stop after only one of them when schema/API shapes changed.
- After changes, update `README.md` to reflect the current project state.

## Commit Practice

- Commit only after the validation routine passes or you have an explicit documented blocker.
- Keep commits scoped to one coherent change set; avoid mixing unrelated cleanup with behavior changes.
- Before committing, check `git status --short` and confirm generated noise is excluded (for example `*.tsbuildinfo`).
- In the final task summary, state:
  - what changed,
  - what was validated,
  - and any known remaining limitation.

## Live Debug Loop

Use the codex debug surface (`packages/engine/convex/maintenance/codex.ts`) plus Bun scripts for run/window triage and safe recovery.

### Orchestration Model (Current)

- The engine uses native Convex scheduler + internal actions/mutations.
- `@convex-dev/workflow` / workpool is not used in the run/window hot path.
- Scheduler dispatch is bounded per tick to prevent runaway queue growth.
- Scheduler now auto-requeues due orphaned requests during normal ticks.
- Batch/job leases are renewed through long-running submit/run/apply sections to reduce duplicate work after lease expiry.
- Batch poll leases are still used to prevent concurrent duplicate poll/apply.
- Batch submit now has a durable `submitting` state; unknown-outcome submit failures should recover via provider metadata lookup before any re-submit path.

### Preflight

- Confirm you are in `packages/engine`.
- Prefer dry-run actions first.

### Monitor

- Run process: `bun run debug:watch --run <run_id>`
- Window process: `bun run debug:watch --window <window_id>`
- Trace tail: `bun run debug:tail --trace run:<run_id>` (reads capped local recent events + Axiom trace ref)
- Synthetic matrix runner: `bun run debug:matrix` (nukes between scenarios, runs low-sample synthetic window/run cases, writes markdown report)
- Process telemetry analysis: `bun run debug:analyze --run <run_id>` or `bun run debug:analyze --window <window_id>` (summarizes the capped local recent-events mirror)

### Diagnose

- List stuck work globally: `bun run debug:stuck --older-ms 120000`
- List stuck work for runs only: `bun run debug:stuck --older-ms 120000 --run <run_id>`
- Deep trace diagnostics: use the `external_trace_ref` from `getProcessHealth` / `debug:tail` / `debug:analyze` to pivot into Axiom.
- `getStuckWork` includes `meta` (`truncated`, `scan_caps_hit`, `health_checks_limited`); treat it as bounded output, not guaranteed global exhaustiveness.

### Recover (safe automation)

- Dry-run auto-heal run: `bun run debug:heal --run <run_id>`
- Apply auto-heal run: `bun run debug:heal --run <run_id> --apply`
- Dry-run auto-heal window: `bun run debug:heal --window <window_id>`
- Apply auto-heal window: `bun run debug:heal --window <window_id> --apply`
- Heal CLI supports paging flags: `--cursor <n>` and `--max-actions <n>`.
- For large backlogs, page heal actions with `packages/codex:autoHealProcess` args `cursor` + `max_actions` and continue until `meta.next_cursor` is `null`.
- Run-count backfill: dry-run `packages/codex:backfillRunCompletedCounts` with `{ "dry_run": true, "cursor": 0, "max_runs": 100 }`, then apply with `dry_run: false` until `next_cursor` is `null`.
- Experiment-total backfill: dry-run `packages/codex:backfillExperimentTotalCounts` with `{ "dry_run": true, "cursor": 0, "max_experiments": 100 }`, then apply with `dry_run: false` until `next_cursor` is `null`.
- Window-count backfill: dry-run `packages/codex:backfillWindowCompletedCounts` with `{ "dry_run": true, "cursor": 0, "max_windows": 100 }`, then apply with `dry_run: false` until `next_cursor` is `null`.
- Pool-count backfill: dry-run `packages/codex:backfillPoolEvidenceCounts` with `{ "dry_run": true, "cursor": 0, "max_pools": 100 }`, then apply with `dry_run: false` until `next_cursor` is `null`.

### Recovery Guardrails

- Default to dry-run for first pass.
- Only use codex safe actions (`start_scheduler_if_idle`, request requeue, expired lease release, poll nudge).
- `submitting` batches are pollable/debuggable the same as `running`/`finalizing` batches; a missing `batch_ref` during `submitting` should be treated as recoverable first, not immediately terminal.
- If a process remains stalled after safe actions, inspect `getProcessHealth`, local recent events, and the Axiom trace before any manual data mutation.
- `domain/maintenance/danger:deleteRunData` uses `isDryRun` (not `dry_run`) and blocks active runs unless `allow_active=true`.
- `domain/maintenance/danger:deleteExperimentRunData` wipes run-scoped data for one experiment while preserving windows, pools, and the experiment config row; prefer it over full table nukes when iterating on canaries.

### Telemetry Notes

- Full telemetry is exported best-effort to Axiom via Convex actions using `AXIOM_TOKEN` + `AXIOM_DATASET`.
- Convex keeps only a small `process_observability` mirror for the live loop plus `scheduler_locks` for the scheduler heartbeat/lock.
- `bun run telemetry:check` runs a real Axiom ingest smoke test through `packages/codex:testAxiomIngest`.
- `domain/maintenance/danger:deleteRunData` now refuses active runs (`start|queued|running|paused`) unless `allow_active=true` is explicitly passed.

### Synthetic Matrix Notes

- Synthetic fault injection hooks have been removed from runtime code.
- Historical synthetic matrix reports are preserved in `packages/engine/docs/` for comparison.

## Fresh-Context MCP Runbook

Use this when a new Codex instance has zero prior context.

### 1. Identify deployment and latest experiments

- `mcp__convex__status` with `projectDir=/Users/jesselee/dev/research/jg/judge-gym/packages/engine`
- `mcp__convex__run` -> `packages/lab:listExperiments` with `{}`

### 2. Clone a new experiment from an existing experiment

- Source config:
  - `mcp__convex__run` -> `packages/lab:getExperimentSummary` with `{ "experiment_id": "<source_experiment_id>" }`
- Source evidence set:
  - `mcp__convex__run` -> `packages/lab:listExperimentEvidence` with `{ "experiment_id": "<source_experiment_id>" }`
- Create new experiment:
  - `mcp__convex__run` -> `packages/lab:createPool` with:
    - `evidence_ids` from source evidence list
    - optional `pool_tag` override
  - `mcp__convex__run` -> `packages/lab:initExperiment` with:
    - `experiment_config` from source summary (`rubric_config`, `scoring_config`)
    - `pool_id` from `createPool`
- Model swap clone (common A/B pattern):
  - Keep all fields the same, but set both:
    - `experiment_config.rubric_config.model`
    - `experiment_config.scoring_config.model`
  - Example target: `"gpt-4.1"`

### 3. Start run and monitor

- Start:
  - `mcp__convex__run` -> `packages/lab:startExperimentRun` with `{ "experiment_id": "<new_experiment_id>", "target_count": <n> }`
- Parallel run caveat:
  - If two starts are triggered concurrently, `packages/lab:startExperimentRun` can OCC conflict under heavy `llm_requests` churn.
  - Safe fallback:
    1. call `domain/runs/run_service:startRunFlow` with same args,
    2. call `domain/orchestrator/scheduler:startScheduler`,
    3. optionally emit `run_started` via the normal workflow path; trace export is automatic and best-effort.
- Monitor:
  - `mcp__convex__run` -> `packages/lab:getRunSummary`
  - `mcp__convex__run` -> `packages/lab:getRunDiagnostics`
  - `mcp__convex__run` -> `packages/lab:getTraceEvents` (local recent-events mirror only)
  - Optional CLI: `bun run debug:watch --run <run_id>`

### 4. Stall diagnosis and safe recovery

- Find stuck work:
  - `mcp__convex__run` -> `packages/codex:getStuckWork`
  - CLI: `bun run debug:stuck --older-ms 120000`
- Heal:
  - Dry-run: `mcp__convex__run` -> `packages/codex:autoHealProcess` with `dry_run: true`
  - Apply: same call with `dry_run: false`
  - CLI: `bun run debug:heal --run <run_id>` then `--apply`

### 5. Current `getProcessHealth` behavior

- `packages/codex:getProcessHealth` now reads from `process_request_targets` snapshots instead of per-target `llm_requests` scans, so large fanout runs (for example `target_count=30` with large score-unit fanout) are safe for normal live-debug loops.
- Raw window collection failures (for example Firecrawl quota exhaustion before any evidence rows exist) now mark the window `error` at `l0_raw` and emit `window_collection_failed`; `getStuckWork` also flags old `l0_raw` windows with no evidence and no active transport as `raw_collection_no_progress`.
- `process_request_targets` now stores explicit target resolution (`pending`, `retryable`, `exhausted`, `succeeded`) plus attempt counters; treat it as current target truth, while `llm_requests` remains immutable attempt history.
- `llm_requests` now stores `system_prompt_id` instead of inline system prompt text; inspect `llm_prompt_templates` to recover the canonical system prompt body for a request.
- Run score fanout now lives in `sample_score_targets` / `sample_score_target_items`, and `scoring_config.evidence_grouping` explicitly chooses between `single_evidence` and `bundle`.
- `packages/codex:getProcessHealth`, `packages/codex:getStuckWork`, and `packages/codex:autoHealProcess` now use bounded scans (`take` caps) for internal table/system reads (including `_scheduled_functions`) to avoid Convex read-limit blowups after large historical churn.
- Scheduler liveness checks in codex now prefer `scheduler_locks` heartbeat state and only use a tiny best-effort `_scheduled_functions` fallback, which keeps `getProcessHealth` / `getStuckWork` usable after large history buildup.
- `packages/codex:getStuckWork` now surfaces `retryable_no_transport` when a process stage has retryable targets, no pending replacements, and no active batch/job transport; the scheduler now auto-requeues that state during normal ticks.
- `packages/lab:getRunDiagnostics` now uses direct `run_id` indexes (`llm_requests.by_run` and artifact `by_run`) for run-scoped diagnostics, replacing prior global artifact scans.
- `packages/lab:getRunDiagnostics` now separates historical failed attempts (`failed_requests`) from terminal failed targets (`terminal_failed_targets`) and includes a short failed-output preview when present.
- `llm_batches` and `llm_jobs` now expose 1-based `attempt_index`; treat it as canonical and view legacy `attempts` on batches as compatibility-only.
- `packages/lab:listRunScoreTargets` lists frozen score-target membership so operators can inspect bundle composition per run.
- `packages/codex:getProcessHealth` now combines `process_request_targets` with `process_observability` for local watch loops.
- `packages/codex:getProcessHealth` now returns `request_state_meta` so operators can see when health state is approximate/bounded, and splits terminal failure classes (`error_summary`) from historical attempt noise (`historical_error_summary`).
- `packages/codex:analyzeProcessTelemetry` and `packages/lab:getTraceEvents` summarize the capped local recent-events mirror only; use the returned `external_trace_ref` for full Axiom history.
- `startScheduler` now debounces manual/redundant kickoff requests through `scheduler_locks` before falling back to the bounded scheduled-function scan.

### 6. Retry semantics (current expectation)

- Parse/orchestrator-side apply failures are treated as terminal request failures.
- Provider/network/rate-limit classes remain retryable up to policy caps.
- Every retry is represented as a new `llm_requests` row with a 1-based `attempt_index`; failed attempts remain persisted for forensic analysis.

### 7. One-off run count repair

- `runs` now persist both `target_count` and `completed_count`.
- `windows` now persist both `target_count` and `completed_count`.
- `pools` now persist `evidence_count`.
- `experiments` now persist `total_count`, defined as the sum of `completed_count` across their runs.
- `samples` now persist `score_count` and `score_critic_count`, and legacy sample-level `score_id` / `score_critic_id` fields have been removed after backfill.
- Historical rows can be repaired with `mcp__convex__run` -> `packages/codex:backfillRunCompletedCounts`.
- Recommended flow:
  1. dry-run a page with `{ "dry_run": true, "cursor": 0, "max_runs": 100 }`,
  2. inspect `rows[].changed`,
  3. rerun with `dry_run: false`,
  4. continue while `next_cursor` is non-null.
- Experiment aggregates use the same paging flow with `packages/codex:backfillExperimentTotalCounts` and `max_experiments`.
- Window aggregates use the same paging flow with `packages/codex:backfillWindowCompletedCounts` and `max_windows`.
- Pool aggregates use the same paging flow with `packages/codex:backfillPoolEvidenceCounts` and `max_pools`.
- Sample score aggregates use the same paging flow with `packages/codex:backfillSampleScoreCounts` and `max_samples`; this mutation also strips legacy sample score ID fields from old rows before final schema removal.

## Agentic Recursion Contract

For every merged behavior change (orchestration, telemetry, retries, scheduling, diagnostics):

1. Documentation update check is mandatory

- Update `AGENTS.md` when operator flow, debugging flow, or agent workflow changes.
- Update `README.md` when architecture, tables, scripts, or user-facing behavior changes.
- Update `docs/live_debug_loop.md` when debug commands, MCP function usage, or recovery playbooks change.

2. Evidence + validation note is mandatory

- Record what was validated (typecheck/tests/live checks) in the PR or task summary.
- If a limitation remains, document:
  - exact symptom,
  - scope/impact,
  - current workaround,
  - planned fix direction.

3. Fresh-context operability is mandatory

- A new agent with no prior context must be able to:
  - identify deployment,
  - clone/start an experiment from existing configs,
  - monitor progress,
  - diagnose stalls,
  - apply safe recovery.
- If any of these steps changed, update the “Fresh-Context MCP Runbook” in the same change.

4. Release gate

- No change is considered complete until the docs above are updated or explicitly confirmed unchanged in the final task summary.
- Git commit your changes with sensible organization and clear commit messages.
