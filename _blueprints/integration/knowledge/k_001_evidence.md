# Lab UI window editor uses initEvidenceWindowAndCollect

**Confidence:** 0.72

**Sources:**
- refactor-everything:packages/lab/app/editor/window/page.tsx

**Summary:**
The refactor-everything lab UI’s evidence window editor calls the Convex action `api.lab.initEvidenceWindowAndCollect` to create a window and collect evidence in one step, then routes back to the home page.
