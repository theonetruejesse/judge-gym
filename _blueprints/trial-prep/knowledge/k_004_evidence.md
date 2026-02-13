# Evidence ingestion supports neutralized content

**Confidence:** 0.78

**Sources:**
- packages/engine/convex/domain/experiments/entrypoints.ts

**Summary:**
The insertEvidenceBatch mutation accepts evidences containing raw_content plus optional cleaned_content, neutralized_content, and abstracted_content and writes those fields to the evidences table, enabling manual population of the neutralized view.
