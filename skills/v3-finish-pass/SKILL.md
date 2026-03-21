---
name: v3-finish-pass
description: Run the autonomous V3 finish-pass campaign for judge-gym. Use when the task is to reset run-scoped V3 state, launch the current V3 cohort, monitor real runs, capture forensic iteration snapshots, diagnose failures with bounded subagent help, patch the smallest blocking bug, validate, and repeat until the V3 matrix completes.
---

# V3 Finish Pass

Use this skill only for the judge-gym V3 campaign in this repo.

## Read first

From the repo root, read:

- `_campaigns/v3_finish_pass/manifest.json`
- `_campaigns/v3_finish_pass/campaign_state.json`
- `_campaigns/v3_finish_pass/bug_ledger.json`
- `_campaigns/v3_finish_pass/observability_backlog.json`

Treat the **experiments table** as the live config source of truth. The manifest only defines:
- cohort membership
- launch modes
- reset/start/status control-plane functions
- monitoring/heal policy
- scientific-validity scope for the current pilot loop

## Control plane

Prefer the manifest-declared control plane:

- `control_plane.snapshot_fn`
- `control_plane.reset_fn`
- `control_plane.start_fn`
- `control_plane.resume_fn`
- `control_plane.inspect_fn`
- `control_plane.control_fn`

Current defaults are:

- `packages/codex:getV3CampaignSnapshot`
- `packages/codex:getV3CampaignStatus`
- `packages/codex:getTemporalTaskQueueHealth`
- `packages/codex:resetV3Campaign`
- `packages/codex:startV3Campaign`
- `packages/codex:resumeV3Experiments`
- `packages/codex:inspectProcessExecution`
- `packages/codex:controlProcessExecution`

Do not reconstruct the cohort by prefix search. Always use the manifest’s explicit tags.

## Campaign states

Use these exact campaign states in reports and `campaign_state.json`:

- `preflight_clean`
- `healthy_progressing`
- `slow_but_progressing`
- `stalled_recoverable`
- `stalled_unknown`
- `scientifically_invalid`
- `forensics_captured`
- `patch_required`
- `validated`
- `complete`

Interpretation:
- `slow_but_progressing` is derived by comparing two **campaign snapshots** over time; the control plane will usually only tell you `healthy_progressing`.
- `scientifically_invalid` means results are not trustworthy even if the run technically completed.
- if Temporal readiness is false, treat the cohort as `stalled_recoverable` unless the snapshot already reports a stronger terminal state.

## Launch modes

Read them from `manifest.json`.

- `canary`
  - use the manifest values directly
  - goal: prove binding + worker polling + first pause gate cheaply
- `rubric_gate`
  - use the manifest values directly
  - goal: prove first two stages are stable at full pilot size
- `full`
  - use the manifest values directly
  - goal: complete the corrected matrix end to end

## Loop

1. Load manifest + campaign state.
2. Read the cohort using `control_plane.snapshot_fn` with the manifest’s explicit tags.
3. If the pass is unhealthy, write an iteration snapshot **before any reset**.
4. Reset with `control_plane.reset_fn`.
5. Launch with `control_plane.start_fn`, passing the manifest’s explicit tags and launch-mode values.
6. Monitor with repeated `control_plane.snapshot_fn`.
7. If snapshot state becomes `stalled_recoverable`, do at most **one** bounded safe-heal pass.
8. If still unhealthy, or if state becomes `scientifically_invalid` or `stalled_unknown`, capture forensics and stop the pass.
9. Diagnose, patch the smallest blocking bug, validate, commit, and start the next iteration.

Safe-heal is diagnostic evidence, not steady-state operating procedure. The objective is an engine that no longer requires agentic monitoring.

### Safe-heal (Temporal-native)

Allowed bounded repairs:

- `packages/codex:controlProcessExecution` with `action="repair_bounded"` and one of:
  - `reproject_snapshot`
  - `resume_if_paused`
  - `clear_pause_after`
- explicit `resume`
- explicit `cancel` only when the cohort is already scientifically invalid and you are preserving forensics first

Do **not** invent queue-era transport repair steps. There is no batch/job/request engine anymore.

## Iteration artifacts

For every unhealthy pass, create:

- `_campaigns/v3_finish_pass/iterations/<id>/snapshot.json`
- `_campaigns/v3_finish_pass/iterations/<id>/report.md`

The snapshot/report must include:
- manifest version
- experiment tags and run ids launched
- launch mode
- expected vs observed counts
- cohort status from `snapshot_fn`
- Temporal readiness summary (run/window queues)
- stuck summary
- dominant failure domain
- scientific validity judgment
- whether safe-heal was attempted and what changed
- chosen patch hypothesis
- validation outcome
- commit hash, if a patch was made

Do not wipe unhealthy run-scoped state before these files exist.

## Failure taxonomy

Use these failure domains:

- `worker_readiness`
- `workflow_binding`
- `raw_collection`
- `stage_activity`
- `provider_or_quota`
- `artifact_apply`
- `projection_staleness`
- `control_contract`
- `observability_blind_spot`
- `spec_or_manifest_mismatch`

Use these scientific-validity labels when needed:

- `scientifically_valid`
- `scientifically_invalid`
- `scientifically_unknown`

## Subagents

Spawn subagents only **after** an iteration snapshot has been written.

Allowed roles:
- state auditor
- telemetry auditor
- code localizer
- observability auditor

Subagents investigate only. The main agent owns:
- reset/launch/abort decisions
- patch selection
- report synthesis
- validation
- commit

## Observability backlog rule

If the agent cannot answer one of these quickly:
- what is the cohort state
- which runs are truly stalled
- whether Temporal workers are polling the expected task queues
- whether results are scientifically usable
- what failure class dominates
- what exact rows explain the failure

then add an item to `_campaigns/v3_finish_pass/observability_backlog.json`.

## Repo coordination

- Follow repo rules in `AGENTS.md`.
- Update `README.md` when behavior or operator surfaces change.
- Keep campaign semantics out of `AGENTS.md`; this skill owns them.
