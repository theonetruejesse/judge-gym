# Agentic Analysis Loop Gap

**Confidence:** 0.89

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/collect.py:174
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/analysis.ts:1
- /Users/jesselee/dev/research/jg/judge-gym/README.md:31

**Summary:**
Analysis client expects `data:exportExperimentBundle`, but the current engine does not implement it. This is a concrete blocker for a fully automated run-to-analysis loop.
