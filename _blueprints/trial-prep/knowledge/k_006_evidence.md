# Lab TUI bootstrapping and experiment settings

**Confidence:** 0.76

**Sources:**
- packages/lab/src/index.tsx
- packages/lab/src/helpers/runner.ts
- packages/lab/src/experiments.ts

**Summary:**
The Lab TUI only bootstraps experiments when LAB_BOOTSTRAP/NEW_RUN env flags are set, calling bootstrapExperiments from runner.ts. Experiment settings (including window, model ids, evidence_limit, sample_count) are hard-coded in experiments.ts.
