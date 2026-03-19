# Monorepo Boundaries Should Follow Runtime Ownership, Not Just Features

**Confidence:** 0.77

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/package.json
- /Users/jesselee/dev/research/jg/judge-gym/turbo.json
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/package.json
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/tsconfig.json
- /Users/jesselee/dev/research/jg/judge-gym/_blueprints/temporal-engine-rewrite/knowledge/k_011_runtime_versioning_and_option_pressure.md

**Summary:**
The repo already shows a mixed-runtime shape: the monorepo is Bun-managed at the root, `packages/engine` declares a Node engine requirement, the current package mixes Convex backend code with Bun-oriented debug scripts, and a single `tsconfig.json` uses `moduleResolution: "Bundler"` for the whole package. That is workable while one package owns everything, but it is the wrong default once Temporal workers become a real Node-only execution surface.

The clean rewrite boundary is package-level, not just folder-level. A good default split is:

1. `engine-contracts`: pure schemas, IDs, enums, and deterministic helpers only.
2. `engine-convex`: Convex schema, mutations, queries, domain projections, and data-facing ledgers.
3. `engine-temporal`: Node-only workflows, activities, workers, provider adapters, and execution policy.
4. `engine-tools` (optional): operational CLIs and agent-loop runners that need to talk to Temporal directly.

The important rule is negative: shared packages must not import runtime-specific code. Anything that imports `convex/_generated`, `@temporalio/*`, provider SDKs, filesystem helpers, or env loaders does not belong in a shared package. This package graph is what prevents a future rewrite from recreating today's cross-runtime ambiguity in a new directory layout.
