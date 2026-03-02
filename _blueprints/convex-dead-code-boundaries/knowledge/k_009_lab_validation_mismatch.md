# Lab vs Backend Validation Mismatch

**Confidence:** 0.6

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/editor/window/_utils/window-form-schema.ts

**Summary:**
The Lab client enforces `evidence_limit >= 1` and validates that `end_date >= start_date`, but the server-side `createWindowForm` mutation only accepts `evidence_limit: z.number()` and `start_date`/`end_date` as plain strings without ordering checks. This leaves a validation gap if non-Lab clients call the API or if client validation is bypassed.
