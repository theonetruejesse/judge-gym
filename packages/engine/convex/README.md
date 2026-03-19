# Engine Convex Backend

Convex backend for judge-gym orchestration, lightweight local observability, and lab control APIs.

## Current Architecture

- Scheduler-driven orchestration for run/window flows.
- Internal actions process queued/running batches and jobs.
- Internal mutations own state transitions and durable table writes.
- Runs persist requested samples (`target_count`), fully finished samples (`completed_count`), per-stage completed counters, and optional `pause_after`.
- Experiments persist `total_count`, the aggregate sum of run `completed_count` values for that experiment.
- Scheduler auto-requeues due orphaned requests on normal ticks.
- `process_request_targets` provides snapshot-backed process health rollups.
- High-volume telemetry is exported best-effort to Axiom from Convex actions.
- Convex keeps only lightweight local observability in:
  - `process_observability`
  - `scheduler_locks`

## Key Modules

- Orchestration:
  - `domain/orchestrator/scheduler.ts`
  - `domain/orchestrator/process_workflows.ts`
  - `domain/orchestrator/base.ts`
- Transport + request lifecycle:
  - `domain/llm_calls/llm_batch_service.ts`
  - `domain/llm_calls/llm_job_service.ts`
  - `domain/llm_calls/llm_request_repo.ts`
- Process domains:
  - `domain/runs/*`
  - `domain/window/*`
- Telemetry / observability:
  - `domain/telemetry/events.ts`
  - `domain/telemetry/emit.ts`
- Debug/ops package API:
  - `packages/codex.ts`
- Analysis export package API:
  - `packages/analysis.ts`

## Operational Notes

- The run/window hot path does not depend on `@convex-dev/workflow`.
- Scheduler dispatch is bounded per tick to avoid fanout explosions.
- Scheduler kickoff relies on the scheduler lock plus debounce guard and avoids scanning Convex `_scheduled_functions` during launch.
- V3 campaign start/resume fan out one scheduled internal mutation per experiment so large cohort launches and bulk resumes do not accumulate run-stage enqueue reads inside a single control-plane call.
- Scheduler requeues due orphaned requests before they require manual heal actions.
- Batch/job lease claims are renewed during long-running workflow sections to reduce duplicate execution after lease expiry.
- Batch submit uses a durable `submitting` state plus provider metadata lookup recovery for unknown-outcome submit failures.
- Batch poll lease claims prevent duplicate concurrent polls.
- Batch retry creation now explicitly kicks the scheduler, so an attempt-2 queued retry cannot be stranded after the previous scheduler loop drains.
- Job request execution is bounded-parallel per job tick via `run_policy.job_request_concurrency`.
- Paused V3 cohort runs can be resumed in place through `packages/codex:resumeV3Experiments`.
- `packages/codex:startV3Experiments` and `packages/codex:resumeV3Experiments` are asynchronous control-plane entrypoints: they schedule per-run work first, then the per-run task creates or resumes the run and kicks the scheduler.
- `packages/codex:resetRuns` supports `allow_active=true` for explicit destructive wipes of paused/running V3 cohort runs before a fresh pass.
- `packages/codex:resetRuns` is paginated via `cursor` and `max_experiments` so large cohort wipes stay under Convex read limits.
- `allow_active=true` wipes now operate as fast relaunch resets for any selected run status: they delete orchestration state plus the run row, zero experiment totals, and retain heavyweight historical artifact/request rows instead of timing out on a full archival scrub.
- Run reconciliation now terminalizes exhausted stages instead of leaving scientifically invalid runs in `running` once no pending work remains.
- `packages/codex:getV3CampaignStatus` includes per-experiment score-target estimates plus a workload-family summary so large-fanout families can be monitored separately during V3 passes.
- `packages/codex:getRunSummary`, `packages/codex:getRunDiagnostics`, and `packages/codex:listRunScoreTargets` mirror the lab debug queries onto the main codex control surface for live loop triage.
- `packages/codex:repairRunStageTransport` repairs a running run stage in place by detaching pending requests from dead/missing transport and reattaching the same request ids to fresh batch/job transport.
- Bundle construction now has a first-class plan layer:
  - `bundle_plans` stores reusable pool-scoped bundling strategies
  - `bundle_plan_items` stores materialized bundle membership for fixed strategies
  - `experiments.bundle_plan_id` optionally points at the plan the run should use
- Runtime bundle resolution is dual-read during the migration:
  - experiments with `bundle_plan_id` use that plan
  - experiments without `bundle_plan_id` still honor `scoring_config.bundle_strategy` directly
  - `window_round_robin` plans preserve the legacy per-sample seeded bundling behavior and therefore do not materialize `bundle_plan_items`
- `packages/lab:createBundlePlan` and `packages/lab:listBundlePlans` expose the reusable plan layer so V3.1 matrices can reuse exact bundle assignments across models and scale settings.
- `packages/codex:backfillExperimentBundlePlans` links existing experiments onto reusable bundle plans without requiring any run resets.
- `packages/analysis:*` exposes public read-only export queries for completed runs:
  - `listAnalysisExperiments`
  - `getAnalysisManifest`
  - `listAnalysisResponses`
  - `listAnalysisRubrics`
  - `listAnalysisEvidence`
  - `listAnalysisSamples`
- Analysis exports are run-scoped and paginated. `responses` is one row per `score_target` with bundled evidence arrays attached, plus stable bundle provenance (`bundle_plan_tag`, `bundle_strategy`, `bundle_signature`, `cluster_id`) so downstream analysis can compare clustering regimes without reconstructing bundle identity heuristically.
- Analysis exports require completed runs; `getAnalysisManifest` is the canonical run-selection surface when the caller starts from `experiment_tag`.
- Run stage progress is stage-local: `rubric_gen` and `rubric_critic` reconciliation do not scan `sample_score_targets`, which keeps early-stage accounting independent of later score-target fanout.
- Request apply/error mutations no longer run full stage reconciliation inline, and they no longer patch shared run/experiment aggregate counters in the per-result hot path; authoritative stage counts and terminal/completed state are synchronized during reconcile.
- Run stage handoff is chunked and asynchronous: `reconcileRunStage` now commits the stage advance first, then `enqueueRunStage` fans out downstream requests in bounded chunks so heavy `score_gen` launches cannot roll back the run-row stage transition.
- `process_request_targets` now treats existing stage artifacts as authoritative success for run/window targets, so stale exhausted request rows cannot mask a successfully applied rubric, rubric critic, score, or score critic artifact.
- Rubric parsing now tolerates the common model failure modes where one stage line uses only one or two semicolons but still contains comma-delimited top-level criteria, and where parenthetical examples contain internal semicolons; delimiter splitting is top-level only, recovered rubric stages may accept up to six criteria when the model compresses a long enumerated clause into one line, and the rubric-gen prompt now explicitly requires semicolon-only criterion separation.
- Score verdict parsing now accepts the common provider-formatting variant where the model emits `- VERDICT: ...` as the final line, and the scoring prompts now explicitly require the final verdict line to begin exactly with `VERDICT:` and not with a bullet prefix.
- Score-stage artifact truth now comes from the `scores` / `score_critics` tables rather than hot `sample_score_targets.score_id` link fields, so score apply and stage-progress readers can tolerate unset legacy target links without stalling score progression.
- Lab/codex run summaries now compute live stage counts from run progress snapshots instead of trusting potentially stale persisted per-stage counters on the `runs` row.
- `getRunDiagnostics` now reports workload score-target estimates plus exhausted-target sample ordinals, so another `29/30` failure can be classified as tail-skewed and workload-coupled from a single query.
- `packages/codex:getStuckWork` now treats queued-only transport backlog with no scheduler heartbeat as a real stall, flags `stage_transition_no_transport` when a run stage is artifact-complete but the next stage never enqueues any transport, and flags `pending_requests_on_dead_transport` when a stage still has pending requests pinned to an error/missing batch or job.
- `packages/codex:autoHealProcess` now plans `repair_stage_transport` actions for pending requests stuck on dead transport instead of only reporting that no active orchestration work exists.
- Retry behavior is class-aware:
  - parse/orchestrator-side apply failures are terminal
  - transient provider classes retry up to configured caps
  - timeout classification recognizes both `timeout` and `timed out` style provider/runtime failures
  - rubric parser contract violations such as `Invalid criteria count` are classified as `parse_error`
- `packages/lab:initExperiment` accepts an optional explicit `experiment_tag`, so follow-up matrices can be inserted into the `experiments` table with stable human-readable tags instead of patching rows after creation.
- `packages/lab:initExperiment` also accepts an optional `bundle_plan_id`, so new experiments can bind directly to a reusable bundling plan instead of relying on implicit grouping behavior.
- `scoring_config` can persist bundle-construction metadata (`bundle_strategy`, `bundle_strategy_version`, `clustering_seed`) and the run path will honor that metadata even before a backfill links the experiment onto an explicit `bundle_plan_id`.
- Local debug loops use `process_request_targets` plus `process_observability`; deep trace history lives in Axiom.
- One-off run metadata repairs go through `packages/codex:backfillRunCompletedCounts` with `dry_run`, `cursor`, and `max_runs`.
- One-off stale run terminal-state repairs go through `packages/codex:backfillRunTerminalStates` with `dry_run`, `cursor`, and `max_runs`; it replays `reconcileRunStage` for artifact-complete or terminal-error runs whose row status/stage got stranded.
- One-off experiment aggregate repairs go through `packages/codex:backfillExperimentTotalCounts` with `dry_run`, `cursor`, and `max_experiments`.
- One-off experiment bundle-plan linkage repairs go through `packages/codex:backfillExperimentBundlePlans` with `dry_run`, `cursor`, and `max_experiments`.
- `bun run telemetry:check` now performs an Axiom ingest smoke test through Convex.

## Validation

After code changes in this package:

```bash
bun run typecheck
```

For V3 campaign execution, use:

- repo skill: `skills/v3-finish-pass/SKILL.md`
- campaign control plane:
  - `_campaigns/v3_finish_pass/manifest.json`
  - `packages/codex:getV3CampaignStatus`
  - `packages/codex:resumeV3Experiments`
  - `packages/codex:resetRuns`
  - `packages/codex:startV3Experiments`
