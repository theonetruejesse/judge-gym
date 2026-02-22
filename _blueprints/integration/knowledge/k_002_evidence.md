# Lab home page lists evidence windows via lab endpoints

**Confidence:** 0.7

**Sources:**
- refactor-everything:packages/lab/app/page.tsx

**Summary:**
The lab home page queries `api.lab.listEvidenceWindows` and uses it to render the Evidence Windows table, linking each row to `/evidence/[id]` and using window metadata like country, model, date range, and evidence status.
