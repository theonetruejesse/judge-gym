# Over-fetching and N+1 in listEvidenceWindows

**Confidence:** 0.66

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/evidence/[id]/page.tsx

**Summary:**
`listEvidenceWindows` loads all windows, then for each window it calls `listEvidenceByWindow` to compute counts and status (a per-window loop that issues additional queries). On the evidence detail page, the Lab UI fetches `listEvidenceWindows` and then selects a single window by id in client code. This indicates an N+1 pattern on the server and over-fetching on the client for single-window views; it likely motivates a per-window query (such as `getWindowSummary`) to reduce work and payload.
