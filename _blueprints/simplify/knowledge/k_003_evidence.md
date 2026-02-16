# Runs snapshot policy and config via run_config_id

**Confidence:** 0.74

**Sources:**
- packages/engine/convex/domain/runs/runs_entrypoints.ts
- packages/engine/convex/models/runs.ts
- packages/engine/convex/models/configs.ts

**Summary:**
Run creation snapshots `ENGINE_SETTINGS.run_policy` and stores it on the run, and creates a run_config row from the template before inserting the run with a `run_config_id`. The run schema includes policy_snapshot and run_config_id fields.
