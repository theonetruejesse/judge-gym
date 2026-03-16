# V3 Iteration Report: 20260316T010116Z_rubric_critic_timeout_exhaustion

- Manifest version: `1`
- Launch mode: `full`
- Deployment: `ownDev`
- Commit at capture: `3f9a3b3233379f26133656c1057ce94be9ddaa81`
- Scientific validity: `scientifically_invalid`
- Dominant failure domain: `stage_reconciliation`
- Safe-heal attempted: `false`

## Expected vs Observed

- Expected cohort size: `22` experiments
- Expected run target count: `30`
- Expected pause behavior: no pause
- Observed latest runs: `22`
- Observed completed latest runs: `1`
- Observed running latest runs: `21`
- Observed latest runs with failures: `16`
- Observed stuck summary: `16 x stage_waiting_on_exhausted_requests`

## Failure Shape

The normal transient version of this pattern is a run sitting at `29/30` while one last request retries after a provider or parse failure. The current cohort has crossed past that state.

At capture time, `16` runs were stuck at `rubric_critic` with:

- `rubric_gen_count = 30`
- `rubric_critic_count = 29`
- `has_failures = true`
- no pending work for the current stage
- request-target resolution already marked `exhausted`

Representative example:

- Run: `kh77g35cyrn0cncx3n9083jat5830kj0`
- Stage: `rubric_critic`
- Failed target key: `sample:ks72twtg6jr7ccy8rxc2evvpjh830w2c:rubric_critic`
- Target resolution: `exhausted`

This is not a parser-repair lag. The representative failed target had no parse output artifact, and diagnostics showed all terminal attempts ending with `Your request timed out.`

## Evidence

Control-plane status showed:

- `campaign_state = scientifically_invalid`
- `latest_runs_with_failures = 16`
- `stuck_summary = [{ "reason": "stage_waiting_on_exhausted_requests", "count": 16 }]`

Representative live failure logs repeatedly showed:

- `domain/runs/run_service:applyRequestResult` timing out
- `domain/runs/run_service:handleRequestError` timing out
- `domain/runs/run_service:reconcileRunStage` timing out
- `domain/orchestrator/process_workflows:processRunningJobWorkflow` failing while calling `applyRequestError` or `reconcileProcessStageAfterTransportFinalized`

Subagent investigation found:

- transient `29/30` is expected while the last target is still retryable
- persistent `29/30` with `has_failures = true` is a real blocker
- the stage counters are derived from source-of-truth sample and target-state rows, so the `29/30` count itself is not a UI accounting glitch
- timeout strings are currently under-classified because the request classifier handles `timeout` but not `timed out`

## Chosen Patch Hypothesis

Patch the smallest blocker in two parts:

1. Improve timeout error classification so operational evidence is correctly labeled.
2. Define an explicit terminal policy for exhausted nonterminal stage targets. The current behavior leaves scientifically invalid runs in `running` forever after max attempts are consumed.

The separate `reconcileRunStage` timeout noise may still need tuning, but it looks secondary to the more important product bug: exhausted rubric-critic targets do not transition the run into a terminal failure state.

## Validation Outcome

Pending. This iteration is forensics only. No reset or heal was performed after the cohort entered the unhealthy state.
