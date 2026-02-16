# Lab UI and pages expect sample_count/evidence_cap on experiment config

**Confidence:** 0.70

**Sources:**
- packages/lab/app/editor/experiment/page.tsx
- packages/lab/app/experiment/[id]/page.tsx
- packages/lab/app/page.tsx

**Summary:**
The Lab UI forms and experiment detail pages read and display `config.scoring_stage.sample_count` and `evidence_cap`, and validation requires them as numeric inputs, so moving counts to run-level will require UI changes.
