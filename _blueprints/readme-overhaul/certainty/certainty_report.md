# Certainty Report

## Evidence Scores
- k_001_final_state_architecture.md: 0.66 (Internal memo is coherent but not fully cross-checked against every surface.)
- k_002_current_readme.md: 0.70 (Direct snapshot of README; reliable for identifying outdated content.)
- k_003_domain_platform_layout.md: 0.82 (Multiple code entrypoints/registries corroborate the layout.)
- k_004_idempotent_llm_requests.md: 0.88 (Schema + helper logic explicitly enforce identity-based de-duplication.)
- k_005_policy_batching_rate_limit.md: 0.80 (Workflows + Lab supervisor show consistent policy enforcement.)
- k_006_public_api_integration.md: 0.76 (Engine exports + consumer code confirm API boundary, with minor drift risk.)

## Hypothesis Scores
- h_A1_001: 0.66 (Layout mapping supported but README must replace old wording.)
- h_A2_001: 0.70 (Idempotency is schema-backed; needs caveat on request_version.)
- h_A3_001: 0.68 (Policy enforcement is real; messaging should stay concise.)
- h_A4_001: 0.64 (Public API boundary exists; downstream usage may evolve.)
- h_A5_001: 0.62 (Diagrams likely helpful but maintenance risk exists.)

## Step Scores
- S1: 0.78 (Domain/platform description is strongly evidenced.)
- S2: 0.82 (Idempotent ledger section is well-supported by schema + code.)
- S3: 0.74 (Policy enforcement and lab sync are supported but nuanced.)
- S4: 0.76 (Public API emphasis is supported by exports + consumers.)
- S5: 0.62 (Diagram recommendations depend on scope and maintenance.)
