# Experiment Surface Evidence

**Confidence:** 0.77

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N04/experiment_prompt_plan.md
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N06/null_challenges.md

**Summary:**
The current experiment config is explicitly pilot-shaped: rubric-first, concept-centric, l0-l3 evidence views, and fixed stage outputs. V4 should separate evidence universe, adjudication task, rubric source, scoring regime, execution, reporting, and reproducibility. But the falsifier shows that a full generic `StagePlan` runner is too large for the first implementation wave. The practical near-term move is a minimal bridge that supports imported or frozen rubrics/codebooks and stricter output contracts while keeping the fixed runner intact.
