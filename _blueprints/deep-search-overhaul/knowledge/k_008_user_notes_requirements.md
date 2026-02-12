# User Requirements for Refactor (Notes)

**Confidence:** 0.7

**Sources:**
- User notes and instructions (2026-02-11)

**Summary:**
The refactor should be designed from first principles, with true batching as a prerequisite for scale. The database is assumed wiped, schemas should be Python-first and snake_case, and a message-led ledger should replace the current usage/thread model. The new message table should store user+assistant pairs including prompt, system instructions, reasoning (when available), final response, and token accounting. Additional requirements: integrate blueprint-batching, replace or rethink the current src-based experimental runner, and define clean data endpoints for analysis to avoid data-shape churn in notebooks.
