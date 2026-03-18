# Temporal Workers Should Use a Narrow Public Convex Worker API, Not Convex Internals as an RPC Surface

**Confidence:** 0.77

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_009_start_and_projection_consistency.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_018_settings_and_config_flow.md
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_019_monorepo_package_runtime_split.md
- https://docs.convex.dev/functions/internal-functions
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/node_modules/convex/src/browser/http_client.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/node_modules/convex/src/server/impl/registration_impl.ts

**Summary:**
The clean Convex <-> Temporal boundary is now concrete enough to freeze:

- `engine-contracts` owns only pure shared types and schemas
- `engine-convex` owns domain truth, policy snapshots, and a small public worker API
- `engine-temporal` owns workflows, activities, workers, provider adapters, and a `ConvexRepo` wrapper that calls only the worker API

The most important constraint is that external Temporal workers should not treat Convex internals as their RPC surface. Convex’s own semantics distinguish public and internal functions, and the easiest-looking shortcut, `ConvexHttpClient.setAdminAuth(...)`, is marked internal in the library surface. That makes it a poor architectural foundation for the rewrite.

So the v0 boundary should be:

1. add a small `convex/worker_api/*` surface with public auth-gated functions
2. have those thin wrappers validate worker auth, enforce idempotency, and delegate to internal mutations
3. keep Activities from reaching into Convex except through one owned `ConvexRepo`

Allowed writes from Activities should be narrow:

- append attempt-ledger rows
- idempotent artifact writes by stable business operation key
- execution linkage / minimal status-projection writes

Disallowed writes should also be explicit:

- experiment-config mutation
- policy-snapshot mutation for in-flight work except dedicated ops-override paths
- anything that would make Convex a second live execution owner

Policy handling should follow the existing blueprint direction:

- reproducible policy belongs in Convex and is snapshotted onto runs/windows or workflow starts
- emergency overrides are separate, explicitly non-reproducible controls

This keeps package boundaries enforceable and prevents the rewrite from drifting back into a hidden mixed-runtime architecture.
