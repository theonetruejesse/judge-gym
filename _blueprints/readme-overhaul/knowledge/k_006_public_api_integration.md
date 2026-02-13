# Public API surface and consumers

**Confidence:** 0.7

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/src/index.ts
- /Users/jesselee/dev/research/judge-gym/packages/lab/src/helpers/clients.ts
- /Users/jesselee/dev/research/judge-gym/packages/lab/src/helpers/console.ts
- /Users/jesselee/dev/research/judge-gym/packages/analysis/src/judge_gym/collect.py

**Summary:**
The engine package exposes Convex models + generated APIs in `src/index.ts`, which downstream packages import via `@judge-gym/engine`. The Lab uses `api` for typed Convex calls and imports shared model schemas for rendering and validation. The analysis package consumes the Convex HTTP API (e.g., `data:exportExperimentBundle`) to pull experiment bundles into pandas DataFrames, so the engine’s public API surface underpins both lab tooling and analysis workflows.
