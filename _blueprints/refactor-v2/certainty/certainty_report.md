# Certainty Report

## Evidence Scores
- k_001: 0.70 (Derived from repo code references; possible hidden invariants across workflows)
- k_002: 0.62 (Convex docs are authoritative but operational semantics/limits can change)
- k_003: 0.60 (Cross-engine patterns are consistent but inferential for this system)
- k_004: 0.58 (Analogous CLI patterns, but user needs may diverge)

## Hypothesis Scores
- h_A_engine_001: 0.50 (Potential concurrency risk; Convex semantics may already prevent duplicates)
- h_A_engine_002: 0.46 (Possible drift with multiple runs; overlap may be disallowed in practice)
- h_A_convex_001: 0.59 (Docs support atomic scheduling in mutations; action requirements unknown)
- h_A_config_001: 0.63 (Strong industry pattern; secret handling/storage cost risk)
- h_A_config_002: 0.57 (Concurrency limits help; scope/provider specifics uncertain)
- h_A_cli_001: 0.60 (Well-supported patterns; may be more than needed now)
