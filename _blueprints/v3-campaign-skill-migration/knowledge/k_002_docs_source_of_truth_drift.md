# Documentation and source-of-truth drift

**Confidence:** 0.9

**Sources:**
- `AGENTS.md`
- `README.md`
- `docs/live_debug_loop.md`
- `docs/pilots/v3_specs.md`
- `packages/engine/convex/README.md`

**Summary:**
The repo documentation currently has overlapping responsibilities. `AGENTS.md` contains stable repo rules, a live-debug runbook, a fresh-context MCP runbook, and V3-like operational doctrine. `docs/live_debug_loop.md` duplicates much of the same operator guidance. `README.md` carries architecture plus substantial operational detail. `docs/pilots/v3_specs.md` mixes research spec with preflight, monitoring, and recovery checklists. This makes it hard for a fresh agent to know which document is authoritative. The docs also drift from current code semantics, especially around bundle configuration terminology and which surfaces are the real operational source of truth. In particular, the current repo truth is the simplified `scoring_config.evidence_bundle_size` field, not a richer nested bundle/grouping object.
