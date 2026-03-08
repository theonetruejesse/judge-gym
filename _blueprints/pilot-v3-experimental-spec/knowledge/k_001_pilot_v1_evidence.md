# Pilot v1 Evidence Summary

**Confidence:** 0.52

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/pilots/v1_distribution_exploration.md

**Summary:**
Pilot v1 established broad cross-model divergence and reliability spread, but also documented major uncontrolled confounds that must be explicitly handled in v3. The strongest actionable signals are: high model-level variance in score ranges and jitter, likely style and order sensitivity, and known confidence calibration issues when certainty is elicited in-context. v1 therefore supports using stronger controls (tone normalization, randomization, abstain-aware scoring, and separate certainty probes), but does not support causal interpretation without ablation-first validation.
