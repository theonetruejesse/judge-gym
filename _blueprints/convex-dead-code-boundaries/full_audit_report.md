# Convex Function Full Audit (Post Cleanup)

## Scope
- Function inventory from `packages/engine/convex/**` exports matching `zQuery`, `zMutation`, `zAction`, `zInternal*`, and workflow definitions.
- Caller matching via generated Convex API paths (`internal.<module>.<function>` and `api.<module>.<function>`).

## Coverage
- Total exported Convex functions/workflow exports audited: **62**
- Used (>=1 caller): **61**
- Dead candidates (0 callers): **0**
- Framework export (not a callable function): **1** (`processWorkflow`)

## Removed In This Cleanup
1. `run_repo`: `createSample`, `listSamplesByRun`, `patchSample`, `createRubric`, `createRubricCritic`, `createScore`, `createScoreCritic`
2. `experiments_repo`: `getExperiment`, `listExperimentEvidence`
3. `llm_request_repo`: `listRequestsByCustomKey`, `listPendingRequestsByCustomKey`
4. `maintenance`: `nukeTables` (file removed)
5. `packages/lab`: `getWindowSummary`

## Lab <-> Engine Boundary (Current)
- Lab public API in active use: `createWindowForm`, `listEvidenceWindows`, `listEvidenceByWindow`, `initExperiment`, `startExperimentRun`, `listExperiments`, `getExperimentSummary`, `listExperimentEvidence`, `getRunSummary`, `getEvidenceContent`.
- Experiment detail page now fetches by route id directly (`getExperimentSummary`, `listExperimentEvidence`) instead of list-first lookup.

## Additional Simplifications Applied
1. `listEvidenceWindows` no longer performs per-window nested queries; it now aggregates evidence in a single pass.
2. Server-side validation now enforces `evidence_limit >= 1` and rejects invalid or reversed date ranges for window creation.

## Artifacts
- Full machine-readable inventory and caller map:
  - `_blueprints/convex-dead-code-boundaries/convex_function_audit.tsv`
