# Likely Unused Internal Repo Functions

**Confidence:** 0.64

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/maintenance/danger.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/llm_calls/llm_request_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/experiments_repo.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/runs/run_repo.ts

**Summary:**
A repo-wide search shows several internal functions only defined at their declaration sites with no call sites elsewhere: `nukeTables` (maintenance), `listRequestsByCustomKey` and `listPendingRequestsByCustomKey` (llm_request_repo), `getExperiment` and `listExperimentEvidence` (experiments_repo), and `createSample`, `listSamplesByRun`, `patchSample`, `createRubric`, `createRubricCritic`, `createScore`, `createScoreCritic` (run_repo). These appear to be leftover or superseded helpers and are likely dead code unless invoked manually or via external tooling.
