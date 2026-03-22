# 20260322T051929Z Projection Freshness Gap On Corrected Runtime

- Manifest version: `2`
- Launch mode: `full`
- Repo head: `d38860ae9841c239bf3caefbd278d864f3ed5d23`
- Cohort size: expected `18`, observed `18`
- Campaign state at capture: `stalled_recoverable`
- Scientific validity at capture: `scientifically_unknown`
- Dominant failure domain: `projection_staleness`

## Summary

The corrected Railway worker fixed the batch-threshold drift, but the relaunched full cohort still degrades into `stalled_recoverable` under real score-stage load. At capture time the Temporal task queues were healthy, all 18 workflows were still bound/running, and the cohort split was `2 rubric_critic / 16 score_gen`. The control plane still marked 11 runs as stuck because their `process_observability.updated_at_ms` aged past the campaign threshold.

This recurrence is not limited to batch-backed score work. Two direct `rubric_critic` runs were also marked `stale_projection`, which means the blocker is broader than the earlier `minBatchSize` drift. Representative observability rows show:

- Direct run `kx7587261taj450p6nsew8y1bs83dvy7` last updated at `1774156514357` with last event `run_stage_result_applied` on `rubric_critic`.
- Batch run `kx7att5fwyfwyd1jsf0xhk48x983d50k` last updated at `1774156517049` with last event `batch_polled` on `score_gen`.

The representative batch surfaces also show real score-stage work still in flight underneath the stale snapshot:

- `kx7att5fwyfwyd1jsf0xhk48x983d50k`: two `score_gen` batches, `600` total items, all targets still pending at capture.
- `kx77p605g5ybya44jgjnjfctds83djqj`: one `score_gen` batch, `120` items, provider status already `completed` but Convex reconciliation still shows no output file and no applied targets.

## Expected Vs Observed

- Expected experiments: `18`
- Observed selected experiments: `18`
- Observed running latest runs: `18`
- Observed completed latest runs: `0`
- Observed stuck summary: `11 stale_projection`

## Temporal Readiness

- `judge-gym.run`: ready, polling, zero backlog
- `judge-gym.window`: ready, polling, zero backlog
- Blocked queues: none

## Safe Heal

One bounded safe-heal was attempted after capture:

- Process: `kx7att5fwyfwyd1jsf0xhk48x983d50k`
- Action: `repair_bounded`
- Operation: `reproject_snapshot`
- Result: accepted by Temporal control plane

That single repair reduced the cohort from `11 stale_projection` runs to `1 stale_projection` run and refreshed the representative score run’s observability to `batch_completed`. That confirms the workflows are substantially alive underneath the unhealthy snapshot; the recurring blocker is stale liveness projection, not a broad queue outage or missing workflow bindings.

## Patch Hypothesis

The run control plane is relying on `process_observability.updated_at_ms` as a liveness signal, but long-running work is still able to go silent long enough for the cohort to be classified as stuck. The smallest plausible fix is to add explicit process heartbeats around long in-flight work:

- direct-request execution paths in run stages
- batch wait / batch completion apply paths where provider completion does not immediately translate into local result application

Local validation passed for the resulting patch with:

- `cd apps/engine-temporal && bun run test`
- `bun run typecheck`

The next action after validation is to redeploy the Temporal worker, reset back to `preflight_clean`, and relaunch the full cohort on the corrected runtime.
