# Window Prompt Canary (2026-03-05)

Canary scope used before final prompt patch:
- Actor retention (political entity preservation)
- Number/date retention
- Length discipline (`L3 <= L2`)

Dataset slice:
- Latest evidence rows from window `jx71d09f8mc4bdmnhzca2a31md82agay`
- Plus prior comparison windows for regression context (`jx799...`, `jx72...`, `jx78...`)

Findings:
- `L3 <= L2` is fixed on the latest window rows.
- Number/date retention is mostly stable, with minor misses on older windows.
- Remaining issue: L3 over-abstracts causally central political actors (e.g. actor names removed when central to claim meaning).

Patch applied:
- Updated `STRUCTURAL_ABSTRACTION_INSTRUCTIONS` to preserve causally central actors and temporal anchors when needed for claim interpretation.

Expected effect:
- Keep current compression and structure gains.
- Reduce semantic loss in political/legal narrative evidence where actor identity is part of the core causal chain.
