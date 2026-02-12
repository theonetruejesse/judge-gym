# Certainty Report

## Evidence Scores
- k_001_blueprint_init_evidence.md: 0.72
- k_002_blueprint_batching_evidence.md: 0.80
- k_003_current_schema_evidence.md: 0.78
- k_004_runner_layer_evidence.md: 0.70
- k_005_analysis_package_state_evidence.md: 0.74
- k_006_paper_methodology_evidence.md: 0.76
- k_007_missing_probe_stage_evidence.md: 0.67
- k_008_user_notes_requirements.md: 0.70
- k_009_workflow_rate_limiter_evidence.md: 0.74
- k_010_agent_kit_message_usage_evidence.md: 0.72
- k_011_stage_naming_critic_prober_evidence.md: 0.70
- k_012_user_notes_refactor_additions.md: 0.70
- k_013_user_notes_batching_critics.md: 0.70
- k_014_openai_batch_api_evidence.md: 0.76
- k_015_anthropic_message_batches_evidence.md: 0.76
- k_016_gemini_vertex_batch_evidence.md: 0.72
- k_017_user_notes_idempotency_regex.md: 0.70

## Hypothesis Scores
- h_A_arch_deltas_001 (v5): 0.74 (regex-gated acceptance + durable parse errors now explicit)
- h_A_batching_001 (v5): 0.77 (provider docs + Convex-ID idempotency reinforce polling-first batching)
- h_A_schema_001 (v3): 0.69 (normalized message ledger remains supported)
- h_A_orchestration_001: 0.58 (runner replacement still uncertain)
- h_A_analysis_001: 0.66 (export needs clear, contract details pending)

## Step Scores
- S1: 0.72
- S2: 0.73
- S3: 0.75
- S4: 0.76
- S5: 0.58
- S6: 0.64
- S7: 0.65
