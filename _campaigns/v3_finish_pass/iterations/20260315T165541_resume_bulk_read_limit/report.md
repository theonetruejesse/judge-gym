# V3 Finish Pass Iteration 20260315T165541_resume_bulk_read_limit

- Manifest version: `1`
- Launch mode: `full`
- Resume request: `pause_after=null`, `start_scheduler=true`
- Expected resumed runs: `22`
- Observed resumed runs: `0`

## Outcome

Bulk resumption of the paused rubric-gate canaries failed before any run changed state. The control-plane mutation `packages/codex:resumeV3Experiments` exceeded the Convex read limit while hydrating score targets for resumed runs.

```text
Too many bytes read in a single function execution (limit: 16777216 bytes)
```

Failure stack:

```text
hydrateScoreTargets -> run_orchestrator.ts:452
listPendingSampleScoreTargets -> run_orchestrator.ts:313
enqueueStage -> base.ts:141
maybeAdvanceRunStage -> run_service.ts:878
resumeV3Experiments -> v3_campaign.ts:475
```

## Cohort State

- Cohort remained unchanged after failure.
- `22/22` runs are still paused at `rubric_critic`.
- Scientific validity remains `scientifically_valid`.
- Stuck summary: none.

## Failure Classification

- Dominant failure domain: `stage_reconciliation`
- Scientific validity judgment: `scientifically_valid`
- Safe-heal attempted: `false`

## Next Step

Resume the same paused runs in smaller batches using `experiment_tags` so the score-target hydration workload stays under the Convex read limit.
