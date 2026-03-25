# Bundle Policy And Missing Code

## Bundle Policy

Headline literature-audit targets should not use bundles by default.

- `Gilardi`: single-item fidelity unit
- `Zheng / MT-Bench`: benchmark-native unit

Bundle checks belong in:

- `Ziems` appendix or follow-on, if a coherent grouped slice is precommitted
- native evidence-set studies where grouping is part of the instrument

This keeps the headline V4 paper faithful while preserving the V3 lesson that grouping is a first-order lever.

## Missing Code Checklist

### Required Before Target-Specific Canaries

1. `paper_audit_packages` control-plane registry
2. target import adapters:
   - `Gilardi`
   - `Zheng`
3. target-specific prompt or rubric package storage
4. target-specific canary scripts
5. OpenRouter/Qwen support in the smoke harness

### Required Before Bundle-Sensitive Appendix Work

1. `semantic_cluster` support for evidence-set-backed runs
2. `semantic_cluster_projected` support for evidence-set-backed runs

### Not Required Before Headline Wave-1 Execution

1. `Ziems` import
2. bundle-sensitive `Gilardi`
3. bundle-sensitive `Zheng`
4. broader OpenRouter watchlist execution

## Final Read

The V4 engine is already far enough along to start target-ready implementation. The missing work is no longer foundational schema or provider plumbing. It is packaging, reproducibility, and target-specific execution harnesses.
