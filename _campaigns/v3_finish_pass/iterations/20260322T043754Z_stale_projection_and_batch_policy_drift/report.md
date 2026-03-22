# V3 Finish Pass Iteration Report

- Iteration: `20260322T043754Z_stale_projection_and_batch_policy_drift`
- Manifest version: `2`
- Launch mode: `full`
- Commit at observation: `d38860a`
- Scientific validity: `scientifically_unknown`
- Dominant failure domain: `projection_staleness`

## Cohort

- Experiment tags: 18 explicit V3 tags from `_campaigns/v3_finish_pass/manifest.json`
- Expected counts:
  - experiments: `18`
  - target_count per experiment: `30`
  - pause_after: `null`
- Observed counts at capture:
  - running: `18`
  - paused: `0`
  - completed: `0`
  - error: `0`
- Stage distribution at capture:
  - `rubric_gen`: `8`
  - `rubric_critic`: `9`
  - `score_gen`: `1`
  - `score_critic`: `0`

## Observed State

- Campaign state from `packages/codex:getV3CampaignSnapshot`: `stalled_recoverable`
- Temporal readiness:
  - `judge-gym.run`: ready
  - `judge-gym.window`: ready
- Stuck summary:
  - `stale_projection`: `1`
- Stuck process:
  - run `kx732c9ye0z42a4j0qd4mvapm183cj6d` at `rubric_critic`
  - Temporal workflow still `RUNNING`
  - batch reconciliation shows one 30-item `rubric_critic` batch with provider status `completed`, Convex batch status still `submitted`, and partial apply progress (`3` succeeded, `27` started)

## Policy Audit

- Repo policy at `d38860a` is `minBatchSize=35`.
- Live behavior does not match that policy:
  - run `kx735zam7xndvknt1vxymak84s83dbxa` used one `rubric_gen` batch for `30` items
  - run `kx767xjkzsyqxdx7v9fz9pxems83dmms` used one `rubric_critic` batch for `30` items
- Root cause is runtime drift, not the checked-in decision function:
  - Railway deployment for `engine-temporal-worker` was created at `2026-03-22T01:16:06.814Z`
  - repo commit `d38860a` was committed later at `2026-03-22T04:10:09Z`
  - the prior repo commit `b4e98eb` still had `minBatchSize=30`, which matches the live under-threshold batches

## Diagnosis

1. The immediate unhealthy state is a projection lag, not a dead workflow.
   - `inspectProcessExecution` still shows the stale run workflow as present and `RUNNING`.
   - The stuck reason is `stale_projection`, and the affected run has in-flight apply/reconciliation state.

2. The live worker is not enforcing the repo's current batching policy.
   - The checked-in route-selection code compares `itemCount >= minBatchSize`.
   - The repo default is now `35`.
   - Current live runs are still batching 30-item stages, which is only consistent with the pre-`d38860a` deployment.

## Safe-Heal Plan

- Allowed bounded repair to attempt once:
  - `packages/codex:controlProcessExecution`
  - `action="repair_bounded"`
  - `operation="reproject_snapshot"`
- Reason:
  - the current unhealthy signal is projection lag on a still-running workflow
  - this is the least invasive protocol-compliant repair

## Safe-Heal Outcome

- Attempted once:
  - `process_id`: `kx732c9ye0z42a4j0qd4mvapm183cj6d`
  - `operation`: `reproject_snapshot`
  - `cmd_id`: `cmd:repair_bounded:run:kx732c9ye0z42a4j0qd4mvapm183cj6d:1774154321363`
- Result:
  - accepted by control plane
  - subsequent cohort snapshot returned to `healthy_progressing`
  - stuck summary cleared to empty
  - no queue-readiness regression observed

## Chosen Patch Hypothesis

- No repo patch is selected yet.
- The first corrective action should be one bounded reproject heal for the stale run.
- If the cohort stabilizes after that, the remaining blocker is operational: redeploy the Temporal worker from `d38860a` or newer so the live runtime actually enforces `minBatchSize=35`.
