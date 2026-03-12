# Post-Full-Load Audit

## Executive Summary

The current batch exposed two distinct classes of defects:

1. **Real provider instability** concentrated in `rubric_critic`, primarily timeout / "try again later" failures. `Axiom` shows `406` `request_error` events in `run / rubric_critic`, almost all classed as `unknown`. `batch_apply_error` corroborates this, with `20` timeout failures and `8` "try again later" failures in `rubric_critic`. See `knowledge/k_002_axiom_failure_pattern.md`.
2. **Engine recovery gaps** after transient failure. Multiple runs were left in `running` with zero active transport and `29` retryable `rubric_critic` requests. `autoHealProcess` identified and requeued all stranded requests, proving this is a missing automatic recovery path, not just a provider problem. See `knowledge/k_003_recovery_gap.md`.

This means the system is **not cleanly self-healing yet**, and the current batch should be treated as a high-value failure corpus before the next reset. See `knowledge/k_001_convex_terminal_state.md` and `knowledge/k_003_recovery_gap.md`.

## Current State

- Total runs observed: `44`
- `completed`: `28`
- `running`: `16`
- `process_request_targets`:
  - `succeeded`: `3280`
  - `retryable`: `438`
- Retryable concentration:
  - `rubric_critic:retryable = 406`
  - `score_gen:retryable = 16`
  - `score_critic:retryable = 16`

This means the batch is still not fully settled, and several runs remain in a retryable-but-incomplete state. See `knowledge/k_001_convex_terminal_state.md`.

## Confirmed Bugs

### B1. Retryable requests can strand with no transport

**Symptom**
- Runs remain `running` in `rubric_critic`
- `active_transport` is all zero
- `getStuckWork` returns no items
- `autoHealProcess` proposes bulk `requeue_retryable_request` actions

**Evidence**
- Direct process health for representative runs:
  - `kh760sqw651w3m0h93yp8vxd0h82r1y7`
  - `kh79ymw1gxjymhk2e182kb031d82sypf`
  - `kh7ant1a79k75t14bv7gce1vp582s5sy`
- `autoHealProcess` dry-run returned `29` requeue actions for each run, then applying it requeued them. See `knowledge/k_003_recovery_gap.md`.

**Assessment**
- This is an engine bug.
- The requests are retryable and recoverable, but the system does not automatically requeue them.

### B2. `getStuckWork` misses retryable-no-transport stalls

**Symptom**
- `items=[]` even while runs are effectively dead in place
- The only reliable detector was `getProcessHealth` / `autoHealProcess`

**Evidence**
- Same representative stalled runs above
- `getStuckWork` remained empty during the stall period. See `knowledge/k_003_recovery_gap.md`.

**Assessment**
- Monitoring semantics are incomplete.
- This needs a dedicated stuck reason for "retryable requests present, no active transport, no pending work owner".

### B3. `llm_batches` / `llm_jobs` attempt semantics are inconsistent with `llm_requests`

**Symptom**
- `llm_batches` uses a compact `attempts` field rather than explicit `attempt_index`
- `llm_jobs` currently reports `attempts=undefined` across observed rows

**Evidence**
- `llm_batches`: `1:success=48`, `3:error=14`, `1:error=2`
- `llm_jobs`: `undefined:success=233`
- See `knowledge/k_004_attempt_model_mismatch.md`.

**Assessment**
- This is a quality-of-life and forensic-debugging defect.
- It does not block execution, but it degrades debugging and should be normalized.

## Confirmed Non-Primary Issues

### N1. Provider timeout pattern is real

**Evidence**
- Axiom `request_error` counts are dominated by `rubric_critic` unknown failures
- `batch_apply_error` payloads are mostly timeout / temporary provider failures
- See `knowledge/k_002_axiom_failure_pattern.md`.

**Assessment**
- This is not an engine fabrication.
- But the engine must recover this class automatically.

### N2. Minor OCC tail exists in score apply

**Evidence**
- Axiom shows `orchestrator_error` for `score_gen` and `score_critic`, each count `16`
- Representative errors mention OCC conflicts on `sample_score_targets`
- See `knowledge/k_002_axiom_failure_pattern.md`.

**Assessment**
- Secondary issue.
- Not the dominant current blocker, but worth patching after the recovery gap.

## Recommended Patch Order

### S1. Add explicit stuck detection for retryable-no-transport

**Change**
- In `packages/engine/convex/domain/maintenance/codex.ts`, flag runs/windows where:
  - `resolution=retryable` exists
  - no `pending` target exists
  - no running/queued batch or job exists
  - no orphaned request exists
- Add a new stuck reason for this state.

**Verification**
- Reproduce a provider-timeout lane
- Confirm `getStuckWork` surfaces the run before manual heal

### S2. Add automatic recovery for stranded retryables

**Change**
- In the scheduler or reconciliation path, if a process has retryable request targets with no transport, automatically enqueue safe requeue actions.
- This should use the same logic as `autoHealProcess`, but on the hot path or periodic tick.

**Verification**
- Reproduce the timeout state
- Confirm the requests requeue without manual intervention

### S3. Patch run-state reporting for stalled retryable runs

**Change**
- Keep top-level terminal semantics unchanged, but for live stalled runs make health surfaces clearly show:
  - retryable request count
  - no active transport
  - recoverable stalled state

**Verification**
- `getProcessHealth` should make the state obvious without opening `autoHealProcess`

### S4. Reduce OCC in score apply on `sample_score_targets`

**Change**
- Review `applyRequestResult` and related score target updates to reduce concurrent writes on the same score-target row.
- Consider narrower patches or less coupled progress updates.

**Verification**
- A rerun should eliminate or materially reduce the current `orchestrator_error` tail

### S5. Normalize attempt semantics for batch/job layers

**Change**
- Add `attempt_index` to `llm_batches` and `llm_jobs`, mirroring `llm_requests`
- Remove ambiguity around the current `attempts` field
- Fix `llm_jobs.attempts` being undefined

**Verification**
- New rows should show explicit attempt progression in all three layers

## Recommended Reset Sequence

1. Finish the audit and capture this bundle.
2. Let the current batch settle as far as it will, or stop after enough evidence is captured.
3. Patch `S1-S3` before the next rerun.
4. Nuke **run-scoped** data only, preserving windows/pools/experiments.
5. Rerun the batch.
6. Use the rerun to evaluate whether provider-only instability remains after automatic recovery is in place.

## Acceptance Criteria For The Next Rerun

- `getStuckWork` explicitly surfaces retryable-no-transport stalls.
- Stranded retryables are requeued automatically without manual heal.
- Post-timeout runs resume and complete without operator intervention.
- `llm_batches` / `llm_jobs` expose explicit attempt progression.
- Remaining failures, if any, are attributable to provider behavior rather than engine deadlock.
