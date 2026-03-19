# Fresh-agent bootstrap path and manifest design

**Confidence:** 0.87

**Sources:**
- `AGENTS.md`
- `packages/engine/convex/packages/lab.ts`
- `packages/engine/convex/domain/maintenance/codex.ts`
- `docs/pilots/v3_specs.md`

**Summary:**
A fresh agent can already identify the deployment, enumerate experiments, clone/init/start runs, inspect status, diagnose stalls, heal, and inspect bundle composition using existing MCP and codex/lab surfaces. The weakness is not bootstrap capability; it is campaign memory and machine-readable launch intent. The automation-critical contract—cohort membership, required configs, target count, pause policy, pool tags, and launch policy—should live in a dedicated manifest instead of being inferred from prose or hardcoded in `reseedV3Experiments`. Volatile runtime state such as run IDs and live counts should continue to be derived from database queries rather than duplicated into the manifest. Because the current experiment-config shape is now simpler than earlier discussions assumed, the manifest only needs to mirror the live scoring fields that actually exist: `method`, `abstain_enabled`, `evidence_view`, `randomizations`, and `evidence_bundle_size`.
