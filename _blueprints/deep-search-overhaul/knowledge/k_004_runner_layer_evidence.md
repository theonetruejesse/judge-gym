# External Experiment Runner Layer Exists

**Confidence:** 0.7

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/src/helpers/runner.ts

**Summary:**
There is a separate TypeScript runner that orchestrates experiments via HTTP calls to Convex (`main.initExperiment`) and tracks runs, indicating a local orchestration layer outside the Convex workflows. This is not described in the original blueprint and is a likely candidate for redesign in the refactor if the runner model is no longer desired.
