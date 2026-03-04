# Existing Baselines And Prior Failure Pattern

**Confidence:** 0.8

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/docs/telemetry_baselines.md
- /Users/jesselee/dev/research/jg/judge-gym/docs/window_fault_injection_snapshot_2026-03-03.md

**Summary:**
Project baselines already capture event counts, route composition, duplicate-apply indicators, and terminal-order invariants for previous windows. Prior injected-failure experiments identified and resolved deadlock behavior in window stage advancement. Remaining gaps are now mostly matrix coverage and regression-proofing under controlled synthetic pressure rather than unknown architectural blind spots.
