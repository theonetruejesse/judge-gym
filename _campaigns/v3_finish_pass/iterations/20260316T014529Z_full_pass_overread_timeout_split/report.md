# V3 Iteration Report: 20260316T014529Z_full_pass_overread_timeout_split

- Manifest version: `1`
- Launch mode: `full`
- Deployment: `ownDev`
- Commit at capture: `ace3a92708c936f31da3d6b6dbac63d8e9b4704f`
- Scientific validity: `scientifically_invalid`
- Dominant failure domain: `stage_reconciliation`
- Safe-heal attempted: `false`

## Expected vs Observed

- Expected cohort size: `22` experiments
- Expected run target count: `30`
- Expected pause behavior: no pause
- Observed latest runs: `22`
- Observed running latest runs: `6`
- Observed error latest runs: `16`
- Observed completed latest runs: `0`
- Observed latest runs with failures: `16`
- Observed workload split:
  - `120` total score targets per run: `6` running, `0` failures
  - `600` total score targets per run: `16` errors, `16` failures

## Failure Shape

This pass is the same core `29/30` failure class as the prior invalid full run, but now with clearer workload coupling.

All `16` experiments whose latest run would eventually need `600` score targets have already terminalized at `rubric_critic` with:

- `rubric_gen_count = 30`
- `rubric_critic_count = 29`
- one exhausted target
- `status = error`

Representative example:

- Run: `kh729fctezs0wrvjqtcp25h8q1831qsd`
- Stage: `rubric_critic`
- Failed target key: `sample:ks71xbxdrs771m1rwwb6xz5zgx8307sj:rubric_critic`
- Resolution: `exhausted`
- Attempts: `3`
- Latest error: `Your request timed out.`

This is not a parser glitch and not a UI lag artifact. The failed target is source-of-truth exhausted state.

## Additional Symptom

The `6` lower-workload families are still progressing, but live Convex failure logs now show:

- `domain/runs/run_service:applyRequestResult` hitting OCC conflicts on `sample_score_targets`
- `domain/runs/run_service:applyRequestResult` also surfacing `Your request couldn't be completed. Try again later.`

That secondary symptom matters because it points at the same read-amplified mutation path rather than a purely provider-side failure.

## Root-Cause Hypothesis

`maybeAdvanceRunStage` calls `getRunStageProgress`, which currently calls `getRunProgressSnapshot`, which unconditionally loads:

- all `samples` for the run
- all `sample_score_targets` for the run
- all `process_request_targets` for the run

That happens even during `rubric_gen` and `rubric_critic`, where score-target rows are irrelevant.

For the `600`-target families, every rubric-stage apply or reconcile mutation pays to read hundreds of extra score-target rows. Under bounded-parallel job execution, many request completions contend on the same oversized read set. That explains:

- repeated timeout-classified final rubric-critic attempts on the `600` families
- OCC conflicts on `sample_score_targets` once score stages begin on the healthier families
- the strong split between `120` and `600` workload families

## Chosen Patch Hypothesis

Patch the stage-progress path so each stage reads only the state it needs:

1. Do not read `sample_score_targets` during `rubric_gen` or `rubric_critic`.
2. Narrow `process_request_targets` reads to only the stages needed for the current stage calculation.
3. Preserve the exhausted-stage terminal behavior added in the previous patch.

If this removes the workload split, the prior timeout/exhaustion symptom and the current OCC symptom should collapse together.

## Validation Outcome

Pending. This iteration is forensics only. No reset or heal was performed after this fresh full pass became unhealthy.
