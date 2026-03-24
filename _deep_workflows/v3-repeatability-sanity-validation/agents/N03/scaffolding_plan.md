# V3 Sanity Rerun Scaffolding (Minimal)

Objective: make a repeatable V3 sanity rerun reliable, inspectable, and comparable to the last validated full pass, using the existing V3 control plane only (no new runtime codepaths).

This workflow treats the sanity rerun as "validated for this turn" once it proves:
1) launch integrity is clean, 2) 30-target rubric stages stay direct-only, and 3) at least one representative `score_gen` provider batch reaches `submitted` with no worker/process error.

## Baseline Anchor (Validated Full Pass)

Use the N01 snapshot as the comparison anchor (it is a summarized view of the live control-plane surfaces):

- Captured: `2026-03-23T16:05:00Z`
- Campaign snapshot: `effective_campaign_state=complete`, `scientific_validity=scientifically_valid`, `selected_experiment_count=18`, `error=0`, `running=0`.
- Temporal: `all_ready=true`, `backlog_count=0`.
- Representative run: `kx73pkbf3wm136p046gkwxne1583cjbd` completed, with stage counts consistent with the full mode shape (`rubric_gen=30`, `rubric_critic=30`, `score_gen=120`, `score_critic=120`).
- Representative score batches exist and completed (one `score_gen`, one `score_critic`).

The sanity rerun should preserve the same cohort membership (manifest explicit tags) and launch mode (`full`) to stay comparable.

## Rerun Entry Gate (Before Any Reset)

Entry gate must be satisfied before touching live state:

- `campaign_state.json` indicates `reset_allowed=true` and `current_blockers=[]`.
- A fresh `snapshot_fn` read of the manifest-scoped cohort shows:
  - `effective_campaign_state in {complete, validated}`.
  - `status.scientific_validity=scientifically_valid`.
  - `status.counts.running=0`, `status.counts.error=0`, `status.counts.latest_runs_with_failures=0`.
  - `status.missing_experiment_tags=[]` (sanity rerun uses the full explicit tag list).
  - `blocked_task_queues=[]` and `status.stuck_items=[]`.
- `temporal_readiness_fn` indicates `all_ready=true` and queue backlog is not accumulating (ideally `approximate_backlog_count==0` per queue).

If any of the above fails, do not reset or relaunch; capture a forensics snapshot instead and stop.

## Minimal Monitoring Checkpoints (What To Capture)

Use only manifest-declared control plane calls plus one optional batch visibility surface.

**Checkpoint A: Pre-reset snapshot (baseline confirmation)**
- Call `snapshot_fn` and `temporal_readiness_fn`.
- Persist: cohort status, counts, stuck summary, queue readiness, worker identities.

**Checkpoint B: Post-reset -> `preflight_clean`**
- Invoke `reset_fn`.
- Poll `snapshot_fn` until:
  - `effective_campaign_state=preflight_clean`
  - `launch_ready=true`
  - `counts.running=0`
  - `blocked_task_queues=[]`, `stuck_items=[]`
- Persist: final post-reset snapshot + how long it took.

**Checkpoint C: Launch integrity**
- Invoke `start_fn` with launch mode `full` and the manifest explicit tags.
- Within a short window (minutes), confirm with `snapshot_fn`:
  - `launch_ready=false`
  - `selected_experiment_count=18` and `with_latest_run=18`
  - `counts.running>0` (or `healthy_progressing` as reported)
  - Temporal readiness still `all_ready=true`
- Persist: initial post-launch snapshot + a list of experiment->run ids if available.

**Checkpoint D: Direct-policy correctness for 30-target rubric stages**
- Choose a representative newly-launched run id (any tag) while it is in `rubric_gen` or `rubric_critic`.
- Call `packages/codex:listBatchReconciliationStatus` with:
  - `process_kind="run"`, `process_id=<run_id>`, `stage="rubric_gen"` (and/or `stage="rubric_critic"`).
- Success criteria:
  - `summary.batch_count=0` for the rubric stages (no `llm_batch_executions` created while under the batch threshold).
- Persist: the reconciliation payload(s).

**Checkpoint E: First `score_gen` batch submission (repeatability proof point)**
- Wait until at least one run enters `score_gen`.
- Call `packages/codex:listBatchReconciliationStatus` with:
  - `process_kind="run"`, `process_id=<run_id>`, `stage="score_gen"`.
- Success criteria:
  - `summary.status_counts.submitted + summary.status_counts.completed >= 1`.
  - At least one batch row has `provider_batch_id` present.
  - Cohort snapshot still has `status.counts.error=0` and `status.counts.latest_runs_with_failures=0`.
- Optional (for debugging unbound/stalled cases): `inspect_fn` to confirm workflow binding + Temporal status + snapshot query errors.
- Persist: reconciliation payload (and optional inspection payload).

## Stop Conditions

Stop early (and avoid further healing/restarts) if any occur:

- Temporal readiness flips to not-ready (`all_ready=false`) or backlog grows persistently during launch.
- Cohort snapshot reports `scientifically_invalid` or `stalled_unknown`.
- `stuck_items` becomes non-empty and remains older than the manifest `stuck_older_than_ms`.
- Any representative run inspected shows a concrete process error / stage activity error.
- Any `score_gen` batch reaches a terminal failure state (`failed`, transport error, apply error) before the first `submitted` proof point is met.
- More than one safe-heal attempt would be required (the manifest policy is a single bounded heal max).

## What Counts As a "Validated Sanity Rerun" (For This Turn)

The sanity rerun is validated (for this workflow turn) when all are true:

- The cohort successfully reset back to `preflight_clean` and relaunches in `full` mode with all 18 required tags.
- A representative rubric-stage run (30 targets) shows `batch_count=0` during `rubric_gen`/`rubric_critic` (direct-only policy preserved).
- At least one representative `score_gen` batch has reached `submitted` with a provider batch id, and the associated run shows no process error.

Full terminal completion is explicitly not required to validate repeatability in this turn.
