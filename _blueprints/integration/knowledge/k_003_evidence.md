# Evidence detail page uses listEvidenceByWindow and getEvidenceContent

**Confidence:** 0.72

**Sources:**
- refactor-everything:packages/lab/app/evidence/[id]/page.tsx

**Summary:**
The evidence window detail page queries `api.lab.listEvidenceByWindow` to populate the evidence list and calls `api.lab.getEvidenceContent` to render raw/cleaned/neutralized/abstracted views via tabs.
