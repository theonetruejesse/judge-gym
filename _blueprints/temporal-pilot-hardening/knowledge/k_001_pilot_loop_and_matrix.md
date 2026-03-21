# Pilot Loop Redesign (Temporal) + Updated V3 Matrix

**Confidence:** 0.78

**Sources:**
- `/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/manifest.json`
- `/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/campaign_state.json`
- `/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/bug_ledger.json`
- `/Users/jesselee/dev/research/jg/judge-gym/_campaigns/v3_finish_pass/observability_backlog.json`
- `/Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/v3_campaign.ts`
- `/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/maintenance/process_debug.ts`
- `https://docs.temporal.io/workflows` (workflow execution semantics, observability surfaces)
- `https://docs.temporal.io/encyclopedia/workflow-message-passing` (signals/queries/updates)
- `https://docs.temporal.io/tctl/task-queue` (pollers and task-queue inspection)

## Summary

The old `v3-finish-pass` loop was built around a Convex-owned execution substrate (batches/jobs/requests/scheduler locks). The Temporal rewrite changes the runtime truth source and therefore the correct control-plane and observability assumptions:

- Execution truth is now **Temporal workflow state** (start/pause/resume/cancel) plus worker pollers.
- Convex is a **projection + artifact store**, not an execution state machine.
- The agent loop should gate launches on Temporal readiness and use Temporal-aware stuck reasons.

Separately, the V3 matrix described in `docs/pilots/v3_gpt_ablations.md` now includes corrected follow-up bundle families `c1` through `c7` (and states the original `a6`/`a7` bundle families were scientifically invalid for direct comparison). The campaign manifest currently references only the earlier 22-tag cohort and will become stale if we attempt to re-run V3-like pilots without updating selection and reporting.

## What Must Change From the Old `v3-finish-pass`

### 1. Control-plane semantics: stop expecting “queue transport”

The campaign loop previously treated failures like “scheduler not running”, “no transport”, or “pending requests on dead transport” as first-class. Those are no longer the right primitives.

The new stuck reasons in the engine are now Temporal-native:
- `missing_workflow_binding`: run/window row has no `workflow_id`
- `stale_projection`: workflow is bound but Convex-local observability mirror is stale
- `retryable_stage_failure`: process is in `error` with a retryable-looking message
- `raw_collection_no_progress`: window stuck before enough evidence exists

Implication for the pilot loop:
- “safe heal” should be a bounded `repairProcessExecution` (start/resume/nudge), not a transport repair.
- any further “heal” after that should become a *hard stop + forensics*, because continued auto-healing becomes a substitute for correctness.

### 2. Read budget assumptions: avoid per-target scans during status

The historical V3 backlog explicitly called out Convex read-limit risk in `getV3CampaignStatus`. The engine has moved away from reading runtime queues for status, but the pilot loop must still remain careful:
- campaign status should read run/window rows plus a bounded amount of `process_observability` and `llm_attempts` metadata
- it should avoid any “scan all score targets to classify stuckness” behavior during hot cohorts

### 3. Temporal readiness gating: verify workers exist before launch

Temporal UI explicitly shows “No workers polling task queue …” and that is a distinct class of stall. The pilot loop should gate launches (and classify cohort state) based on whether the expected task queues have active pollers.

This is new in Temporal compared to a DB-backed queue: you can start workflows even if no worker is currently polling. That’s convenient, but for a “debugging loop” it creates confusing failure states (“stuck” that is not an engine bug).

Concrete changes:
- add a “Temporal readiness” signal to the campaign status:
  - `window` task queue has pollers
  - `run` task queue has pollers
- if readiness is false, classify as `stalled_recoverable` with a distinct reason (infra/workers), and stop any attempt-level diagnosis.

## Updated V3 Matrix Implications

### 1. The manifest is not aligned to the “corrected bundle” story

`docs/pilots/v3_gpt_ablations.md` states:
- original `a6`/`a7` bundle families were excluded from scientific interpretation
- corrected families `c1` through `c7` are the comparable bundle-policy surface

But `_campaigns/v3_finish_pass/manifest.json` still includes `v3_a6_*` and `v3_a7_*` tags and does not include the `v3_1_c*` corrected tags.

Implication:
- if we want the “full pilot debugging loop” to align with the current scientific intent, we need a vNext campaign manifest (or a new campaign id) that targets the corrected families and updates expectations.

### 2. Campaign reporting should treat “scientific validity” as first-class again

The V3 write-up explicitly distinguishes “scientifically invalid” experiment families. The pilot loop should keep that discipline:
- “completed” is not enough
- the loop should mark cohorts invalid if they include known-invalid families (or flag them separately)
- the loop should preserve iteration snapshots before wipe, even when infra is the cause

## Proposed Control-plane API Evolution (vNext)

Keep the existing control-plane entrypoints, but version the semantics:

- `packages/codex:getV3CampaignStatus`
  - add `temporal_readiness` fields (run/window pollers present)
  - include a “workflow binding distribution” (how many runs have workflow ids / run ids)
  - keep `stuck_summary` but using Temporal-native reasons only

- `packages/codex:resetRuns`
  - already clears run-scoped artifacts
  - should also cancel any bound Temporal workflow executions where possible (best-effort, not required for correctness in greenfield)

- `packages/codex:startV3Experiments`
  - gate starts if Temporal readiness is false unless `--force` is passed
  - ensure the manifest used for “expected tags” is aligned to the desired matrix (old 22 vs new corrected families)

## Counterevidence / Uncertainty

- If the Railway Temporal/worker topology is stable and always-on, “pollers present” gating may be overly strict for day-to-day operation. However, it is still valuable for agentic debugging loops where “no workers” should not look like an engine bug.
- The V3 matrix in `docs/pilots/v3_gpt_ablations.md` describes a combined analyzed slice of 32 experiments, but the repo’s current campaign manifest is still the older 22-tag cohort. It’s unclear whether the next pilot is intended to reproduce legacy V3 exactly, reproduce the corrected 32, or define a smaller new matrix. This should be decided explicitly before we encode it as automation.

