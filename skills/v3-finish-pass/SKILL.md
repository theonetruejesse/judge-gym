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

## Control plane

Use these functions for the cohort:

- `packages/codex:getV3CampaignStatus`
- `packages/codex:resetRuns`
- `packages/codex:startV3Experiments`

Do not reconstruct the cohort manually if these are available.

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
- `slow_but_progressing` is derived by comparing two snapshots; the control-plane API will usually only tell you `healthy_progressing`.
- `scientifically_invalid` means results are not trustworthy even if the run technically completed.

## Launch modes

Read them from `manifest.json`.

- `rubric_gate`
  - use `pause_after="rubric_critic"`
  - goal: prove first two stages are stable
- `full`
  - use `pause_after=null`
  - goal: complete the whole matrix

## Loop

1. Load manifest + campaign state.
2. Call `packages/codex:getV3CampaignStatus` for the cohort.
3. If the pass is unhealthy, write an iteration snapshot **before any reset**.
4. Reset with `packages/codex:resetRuns`.
5. Launch with `packages/codex:startV3Experiments`.
6. Monitor with repeated `packages/codex:getV3CampaignStatus`.
7. If status becomes `stalled_recoverable`, do at most **one** bounded safe-heal pass.
8. If still unhealthy, or if status becomes `scientifically_invalid` or `stalled_unknown`, capture forensics and stop the pass.
9. Diagnose, patch the smallest blocking bug, validate, commit, and start the next iteration.

Safe-heal is diagnostic evidence, not steady-state operating procedure. The objective is an engine that no longer requires agentic monitoring.

## Iteration artifacts

For every unhealthy pass, create:

- `_campaigns/v3_finish_pass/iterations/<id>/snapshot.json`
- `_campaigns/v3_finish_pass/iterations/<id>/report.md`

The snapshot/report must include:
- manifest version
- experiment tags and run ids launched
- launch mode
- expected vs observed counts
- cohort status from `getV3CampaignStatus`
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

- `scheduler_kickoff`
- `transport_requeue`
- `provider_submit_poll`
- `parser_contract`
- `artifact_apply`
- `stage_reconciliation`
- `count_accounting`
- `attempt_model`
- `observability_blind_spot`
- `spec_or_manifest_mismatch`

Use these scientific-validity labels when needed:

- `scientifically_valid`
- `scientifically_invalid_prompt`
- `scientifically_invalid_parser`
- `scientifically_invalid_accounting`
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
- whether results are scientifically usable
- what failure class dominates
- what exact rows explain the failure

then add an item to `_campaigns/v3_finish_pass/observability_backlog.json`.

## Repo coordination

- Follow repo rules in `AGENTS.md`.
- Update `README.md` when behavior or operator surfaces change.
- Keep campaign semantics out of `AGENTS.md`; this skill owns them.
