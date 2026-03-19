# Subagent-Guided Analysis Process and Guardrails

**Confidence:** 0.85

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/cache.py
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/src/judge_gym/investigate_v3.py
- /Users/jesselee/dev/research/jg/judge-gym/packages/analysis/_outputs/v3/investigation/summary.json
- /Users/jesselee/dev/research/jg/judge-gym/docs/pilots/v3_gpt_ablations.md
- https://book.the-turing-way.org/reproducible-research/reproducible-research
- https://book.the-turing-way.org/reproducible-research/vcs
- https://doaj.org/article/d1ae89c5312348daa7f079cb92b6048d
- https://academic.oup.com/bioinformatics/article-abstract/28/19/2520/290322

**Summary:**
The repo already has the makings of a reproducible, multi-pass analysis workflow: frozen exported snapshots in SQLite, stable output directories, and a single investigation entrypoint that derives tables before figures. The main risk now is process drift rather than missing infrastructure.

The right coordination model is to freeze an “analysis contract” first: a file that pins snapshot IDs, included experiment tags, excluded invalid families, cache/export schema version, and canonical derived tables. From there, subagents should operate on isolated layers only: one agent for statistics/tables, one for figure triage/layout, one for report assembly. No subagent should refresh exports or mutate the frozen contract.

To keep work convergent, every generated figure and table should have a manifest entry describing its inputs, purpose, and readability status. This converts the analysis from an open-ended pile of charts into a controlled pipeline with explicit provenance and promotion rules for report-grade artifacts.
