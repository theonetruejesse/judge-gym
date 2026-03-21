# Projection And Status Path

**Confidence:** 0.84

**Sources:**
- `apps/engine-temporal/src/workflows.ts`
- `apps/engine-convex/convex/domain/maintenance/v3_campaign.ts`
- `apps/engine-convex/convex/domain/maintenance/codex.ts`

**Summary:**
The separate `projectProcessState` activity had too little timeout budget under live score-stage load, which produced late completion warnings and stale process mirrors. At the same time, V3 campaign status was still broader than necessary because it depended on larger experiment/run reads instead of staying fully scoped to the manifest’s explicit tag set and latest-run `process_observability`.
