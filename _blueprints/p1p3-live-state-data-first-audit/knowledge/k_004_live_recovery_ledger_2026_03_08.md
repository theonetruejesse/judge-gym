# k_004 — Live Recovery Ledger (2026-03-08)

## Scope
- Track runtime interventions and outcomes while experiments are active.
- Focus on scheduler liveness, stalled run recovery, and recurring failure classes.

## Snapshot A (around 2026-03-08 21:17–21:19 local)
- `scheduler_locks` observed stale in repeated reads:
  - `status=idle`
  - `heartbeat_ts_ms=1773024786852` (unchanged across rounds)
- Representative runs showed no stage deltas for ~2 minutes:
  - `kh7acwxwftd8w3k8gcgjymq57182k5hf`
  - `kh768z95mftry44bpjje5yvq3s82kxbr`
  - `kh752n15k37sda30s4ts7epban82k7ds`
  - `kh7e2r0mh7rcvxz81nbp1xpqrx82jd8h`
- Observed symptom class:
  - `scheduler_scheduled=false` on most sampled runs
  - `no_progress_for_ms` rising while pending work remained

## Snapshot B (around 2026-03-08 21:24–21:31 local)
- Scheduler recovered after kick:
  - lock heartbeat resumed (`heartbeat_ts_ms=1773025465265` then advancing)
  - `startScheduler` invoked successfully
- Run health improved for sampled runs:
  - `kh7ac...` now `scheduler_scheduled=true`, rubric stages complete, score stages queued
  - `kh768...` now `scheduler_scheduled=true`, rubric stages complete, score stages queued
  - `kh7cxd...` now `scheduler_scheduled=true`, `score_gen=598/600` with parse-error tail
- Persisting issue:
  - `kh752...` and `kh7e2r...` have long no-progress intervals despite scheduler-scheduled true

## Interventions executed
1. `domain/orchestrator/scheduler:startScheduler`
   - Result: success (`null` return, no error)
2. `packages/codex:autoHealProcess` on stalled runs
   - `kh752...`: success, 30 retryable requests requeued
   - `kh7e2r...`: timed out (`SystemTimeoutError`)
   - `kh7cxd...`: OCC conflict (`OptimisticConcurrencyControlFailure`)

## Recurring surfaced problems
- Scheduler liveness can temporarily stop (heartbeat stalls).
- Safe-heal mutation can fail under load (timeout/OCC), requiring retries.
- Some runs become stage-settled but do not advance reliably without intervention.
- Read-heavy diagnostic endpoints remain risky during load.

## Working operational rule (current)
- Keep using bounded surfaces:
  - `packages/codex:getProcessHealth`
  - direct table reads (`runs`, `scheduler_locks`, `_scheduled_functions`, targeted `llm_*`)
  - Axiom trace pivots (`external_trace_ref`)
- Avoid high-read summary surfaces during high churn.

## Next checks queued
- Retry safe-heal for `kh7e2r...` and `kh7cxd...` with backoff.
- Confirm scheduler heartbeat continues to advance for >2 consecutive rounds.
- Confirm stage deltas on at least 3 representative runs after heal retries.

## Snapshot C (around 2026-03-08 21:36–21:40 local)
- Scheduler heartbeat remained live:
  - `now_ms=1773025851136`
  - `heartbeat_ts_ms=1773025838996` (fresh)
- Recovery attempts:
  - `kh7cxd...`: heal succeeded; large retryable set requeued; run now has queued jobs and fresh job finalize events.
  - `kh7e2r...`: heal retried and timed out again (`SystemTimeoutError`), still stalled in `score_critic`.
- Current run condition highlights:
  - `kh7cxd...`: `no_progress_for_ms` dropped to ~15s, active queued jobs observed.
  - `kh752...`: `no_progress_for_ms` reduced materially (from >1M ms earlier to ~242k ms), still needs one pending rubric critic path to settle before score stages fan out.
  - `kh7e2r...`: remains long-stalled (`no_progress_for_ms` ~6M ms), stage state still `score_gen complete / score_critic pending`.

## Newly surfaced technical signal
- `autoHealProcess` itself is near read limits during heavy churn:
  - repeated `Many bytes read` warnings up to ~15MB in one execution.
  - This is now confirmed as an independent reliability risk in the recovery path.

## Snapshot D (around 2026-03-08 21:42 local)
- Ran `autoHealProcess` dry-run for `kh7e2r...` after timeout-prone apply attempts.
- Dry-run completed and produced a very large candidate action set (many retryable request requeues), confirming the run is recoverable in principle but expensive to heal in one mutation.
- Read pressure warnings persisted throughout dry-run (`Many bytes read` repeatedly), reinforcing that recovery tooling must be chunked/bounded for high-backlog runs.

## Snapshot E (around 2026-03-08 21:50–21:55 local)
- Scheduler status:
  - `heartbeat_ts_ms=1773026068422` with `now_ms=1773026077401` (heartbeat fresh).
- Applied heal cycle:
  - `kh752...`: successful requeue set applied; run now shows fresh rubric_critic activity (`no_progress_for_ms` dropped to ~7s in follow-up sample).
  - `kh768...`: partial apply; many requeues succeeded but heal execution hit read-limit failures mid-stream (`Too many bytes read in a single function execution`) for later actions.
  - `kh7e2r...`: heal apply timed out again (`SystemTimeoutError`), remains hard-stalled in `score_critic` pending.
- Follow-up process health:
  - `kh752...` and `kh768...` currently `scheduler_scheduled=true` with fresh job events.
  - `kh7e2r...` still long-stalled (`no_progress_for_ms` > 6.2M) while top-level run remains `running`.

## Confirmed recurring failure classes (updated)
- Scheduler intermittency (can drop scheduling flag and require explicit kick).
- Recovery-path scalability issue (`autoHealProcess` near/over read limits under high backlog).
- Single-run hard stall class (`score_gen complete`, `score_critic pending`) not consistently recovered by generic heal apply due timeout pressure.

## Snapshot F (around 2026-03-08 21:58–22:05 local)
- Attempted direct stage boundary recovery via:
  - `domain/runs/run_service:reconcileRunStage`
  - Targets: `kh7e2r...`, `kh7cxd...`, `kh7ac...` at `stage=score_gen`
- Outcome:
  - one call timed out,
  - remaining calls failed with read-limit during `run_orchestrator.buildRequestStateIndex` / `listPendingSampleEvidenceTargets`.
- Implication:
  - Stage-transition path itself is currently a bottleneck under this backlog; not just debug/heal surfaces.

## Snapshot G (after forced scheduler restarts + follow-up checks)
- `kh752...`: currently healthy movement (`scheduler_scheduled=true`, fresh rubric_critic events, low `no_progress_for_ms`).
- `kh768...`: resumed movement after partial heal (`scheduler_scheduled=true`, fresh rubric/rubric_critic events), though heal function still read-limit-prone.
- `kh7ac...` and `kh7cxd...`: still stage-boundary stuck pattern (`score_gen settled with failures`, `score_critic pending`, `scheduler_scheduled=false` intermittently).
- `kh7e2r...`: remains hard-stalled (`score_gen 600/600`, `score_critic pending 600`) despite repeated scheduler/heal attempts.

## Convex insights confirmation (same interval)
- `domain/runs/run_service:reconcileRunStage` is now explicitly flagged for `bytesReadLimit` errors.
- `packages/codex:autoHealProcess` remains read-heavy and frequently near limits.
- `packages/lab:*` summary endpoints remain high-risk for bytes/doc limits during active load.

## Snapshot H (around 2026-03-08 22:08–22:12 local)
- Additional heal pass applied:
  - `kh7ac...`: large retryable set requeued successfully; run now has fresh queued/finalized job activity and `scheduler_scheduled=true`.
  - `kh7cxd...`: partial requeue success with many read-limit failures in later action attempts; still shows queued job activity and `scheduler_scheduled=true`.
- Current representative status:
  - `kh7ac...`: active movement in rubric_critic with stage boundary still at `score_gen settled (589 complete, 11 failed), score_critic pending 600`.
  - `kh7cxd...`: same boundary pattern (`score_gen 598/600`, `score_critic pending 600`) with intermittent progress signals.
  - `kh7e2r...`: unchanged hard-stall (`score_gen 600/600`, `score_critic pending 600`, `no_progress_for_ms` still > 6.4M) despite scheduler live.

## Operational conclusion (current cycle)
- Monitoring/heal loop is keeping many runs active.
- Primary blocker to full batch completion is now stage-transition scalability (read-limit in reconcile/orchestrator path), not scheduler heartbeat alone.

## Snapshot I (code patch + immediate validation)
- Patched run-state request indexing to use `process_request_targets` snapshots (both orchestration + run-progress paths), removing global `llm_requests` status scans from:
  - `domain/runs/run_orchestrator.ts`
  - `domain/runs/run_progress.ts`
- Validation:
  - root `bun run typecheck` passed.
  - after deploy/reload, `reconcileRunStage` succeeded for `kh7ac...` and advanced stage (`run_stage_advanced` to `score_critic` observed).
- Remaining behavior:
  - `kh7cxd...` and `kh7e2r...` reconcile calls still occasionally time out, but failure mode shifted away from immediate read-limit crashes and at least one previously stuck run now advances.
  - active run distribution now includes `score_critic` in-flight (`kh7ac...`) with scheduler heartbeat live.

## Snapshot J (around 2026-03-08 22:15–22:33 local)
- Deployment sanity:
  - confirmed active deployment selector `ownDev:...rightful-grouse-57`.
  - scheduler lock observed `status=idle` between ticks, but heartbeat remained fresh after explicit scheduler kicks.
- Boundary reconciliations applied:
  - advanced previously stuck score boundary runs to `score_critic`:
    - `kh7e2r...`, `kh7cxd...`, `kh7d6a...`, `kh74b6...`.
  - advanced rubric boundary runs to score stage fanout:
    - `kh76x7...`, `kh765a...`, `kh768tz...`, `kh79z6...`, `kh70ka...`, `kh752n...`, `kh768z...`, `kh7fmz...`.
- One transient command-path typo and a few transient `InternalServerError` responses occurred during bulk parallel reconcile attempts; retries succeeded for all targeted runs.
- Current active shape after reconciliation wave:
  - active runs reduced from 13 -> 10.
  - stage mix now: `score_gen=8`, `score_critic=2`.
- Representative run health (post-wave):
  - `kh76x7...`: `score_gen completed=107 failed=32 pending=461`, active queued/running jobs (in-flight, not stalled).
  - `kh70ka...`: `score_gen completed=580 pending=20` (nearing boundary).
  - `kh7fmz...`: `score_gen completed=100 pending=500` with running batches.
  - score-critic runs (`kh7fmy...`, `kh7e2r...`) show active running batches and pending drain.
- Scheduler signal now consistently `scheduler_scheduled=true` on sampled runs; no global hard-stop pattern in this interval.

## Updated interpretation
- The patch + manual boundary reconcile strategy is working for this batch:
  - runs are transitioning across stage boundaries again,
  - active transport is visible in score stages,
  - no new systemic read-limit crash in `reconcileRunStage` observed in this interval.
- Remaining completion risk is throughput/latency (long tail pending work), not immediate orchestration deadlock.

## Snapshot K (around 2026-03-08 22:34–22:40 local)
- Active runs dropped further: `10 -> 9` (`completed` count now 9 in recent scan).
- Stage distribution now concentrated in scoring only:
  - `score_gen=6`, `score_critic=3`.
- No scheduler outage signal in sampled runs (`scheduler_scheduled=true` throughout this interval).
- Score-gen run shape shows mixed throughput:
  - high-throughput in-flight: `kh76x7...` (`159/600 complete`, active queued/running jobs), `kh765a...` (`185/600 complete`).
  - near-boundary tails: `kh768z...` (`595/600`), `kh70ka...` (`580/600`), `kh7fmz...` (`580/600`).
  - mid-flight: `kh752n...` (`200/600`).
- Control actions applied this interval:
  - periodic `startScheduler` kick,
  - no destructive intervention,
  - no global nuke/reset.

## Updated interpretation
- Current bottleneck is long-tail score throughput and request retries, not orchestration freeze.
- Boundary reconciliation remains needed when score_gen settles to pending=0, but this interval did not show a new hard stage-lock class.

## Snapshot L (around 2026-03-08 22:41–22:45 local)
- Batch completion continues:
  - active runs `9 -> 8`
  - completed runs `9 -> 10`
  - active stage mix now `score_gen=4`, `score_critic=4`.
- `kh70ka...` showed classic tail-stall signature (`score_gen pending=20`, no active transport, auto-heal dry-run hit read-limit).
- Applied direct `reconcileRunStage(stage=score_gen)` retry for `kh70ka...`:
  - first attempt returned transient `InternalServerError`.
  - second attempt succeeded.
  - run advanced to `score_critic`.
- Additional observation:
  - two formerly long-running score-critic runs dropped out of active set during this interval (`kh7e2r...` and `kh7fmy...`), consistent with completion.

## Updated interpretation
- The remaining work is now a smaller score-only tail.
- Direct stage reconcile remains an effective fallback when `autoHealProcess` is blocked by read limits.

## Snapshot M (around 2026-03-08 22:46–22:50 local)
- Active runs reduced again: `8 -> 6` during this interval, then stabilized at `6`.
- Stage mix: `score_gen=4`, `score_critic=2`.
- No new scheduler outage signal (`scheduler_scheduled=true` in sampled health snapshots).
- Score-gen progress is ongoing across all four remaining score-gen runs:
  - `kh76x7...`: `284 complete / 135 failed / 181 pending`.
  - `kh765a...`: `254 complete / 192 failed / 154 pending`.
  - `kh752n...`: `480 complete / 0 failed / 120 pending`.
  - `kh768z...`: `598 complete / 0 failed / 2 pending` (near boundary).
- Score-critic runs remain in-flight and draining pending counts.

## Updated interpretation
- System is still making forward progress without manual nukes.
- Remaining work is a narrow tail; next likely intervention is stage reconcile on `kh768z...` once score-gen pending reaches zero.

## Snapshot N (around 2026-03-08 22:52 local)
- User-observed burst in Convex dashboard validated against live state.
- Current live counts:
  - active runs: `5` (`score_gen=4`, `score_critic=1`),
  - completed runs: `13`.
- `_scheduled_functions` sample (latest 500):
  - state mix: `498 success`, `1 inProgress`, `1 pending`, `0 failed`.
  - top scheduled function names:
    - `domain/telemetry/events.js:exportEvent` (432)
    - `domain/orchestrator/process_workflows.js:processQueuedJobWorkflow` (60)
    - `domain/orchestrator/process_workflows.js:processRunningBatchWorkflow` (5)
    - `domain/orchestrator/scheduler.js:runScheduler` (3)
- Interpretation:
  - recent burst is expected run-time fanout + telemetry export while score stages drain,
  - no current evidence of schedule backlog (`overdue pending >1m = 0` in sampled view),
  - scheduler lock remains `idle` between ticks, which is expected for this lock model.

## Snapshot O (around 2026-03-08 22:55 local)
- Active runs now `4` (all scoring stages), completed runs `14`.
- Stage mix: `score_gen=3`, `score_critic=1` (briefly observed `score_gen=4/score_critic=0`, then one run advanced).
- Confirmed progress:
  - `kh765a...` advanced to `score_critic` (`score_gen=300 complete / 300 failed`, now draining score_critic pending).
- Remaining tail stall:
  - `kh768z...` still at settled `score_gen` (`599 complete / 1 failed / 0 pending`) with `score_critic pending=600`.
  - direct `reconcileRunStage(score_gen)` retried; latest call timed out.
- Scheduler remained active (`scheduler_scheduled=true` on sampled runs) and periodic kick continues.

## Snapshot P (around 2026-03-08 23:00–23:04 local)
- Active runs now `2` (both `score_critic`), completed `16`.
- Remaining active runs:
  - `kh752n15k37sda30s4ts7epban82k7ds`
  - `kh768z95mftry44bpjje5yvq3s82kxbr`
- Both show active score_critic transport with scheduler_scheduled=true in sampled checks.
- No new stall class surfaced in this interval; this is final scoring tail drain.

## Snapshot Q (2026-03-09 post-tail completion)
- Completion check via bounded run scan:
  - `activeCount=0`
  - `completedCount=18`
- Final tail behavior matched prior pattern:
  - remaining runs drained in `score_critic` after repeated monitor/scheduler/reconcile loop.
- Cross-source sanity outcome:
  - Convex warning-panel items were concordant with MCP insights and prior incident snapshots.

## Snapshot R (2026-03-09 final deep-search sanity sweep)
- Cross-source quantitative check added via Axiom dataset queries (`k_007`).
- Aggregates confirmed consistency with Convex insights warning families:
  - score_gen dominates run errors,
  - rubric-stage errors are secondary,
  - stage advancement/completion counts are coherent with completed cohort.
- Remaining blind spot is narrow and permission-scoped (`starredQueries:read` denied), not runtime-signal scoped.
