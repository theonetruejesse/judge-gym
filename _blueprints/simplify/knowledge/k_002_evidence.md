# Evidence is frozen by binding a batch with evidence_cap slicing

**Confidence:** 0.76

**Sources:**
- packages/engine/convex/domain/experiments/experiments_entrypoints.ts
- README.md

**Summary:**
`bindExperimentEvidence` enforces window match, checks batch size against `evidence_cap`, and inserts only the first `evidence_cap` items (ordered) into `experiment_evidence`, thereby freezing the evidence set used by scoring. The README describes this binding step as freezing evidence selection.
