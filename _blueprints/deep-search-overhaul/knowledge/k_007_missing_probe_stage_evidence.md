# Missing Probe Stage in Current Code

**Confidence:** 0.67

**Sources:**
- /Users/jesselee/dev/research/judge-gym/packages/engine/convex/stages (listing)
- /Users/jesselee/dev/research/judge-gym/_blueprints/blueprint-init.md (lines 1-314)

**Summary:**
The original blueprint includes a `4_probe` stage (fresh-window probing), but the current Convex `stages` directory only contains `1_evidence`, `2_rubric`, and `3_scoring`. This indicates the probe stage remains unimplemented or has been removed, which affects the paper’s calibration and expert agreement analysis.
