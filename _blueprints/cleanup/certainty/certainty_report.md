# Certainty Report

## Evidence Scores
- k_001: 0.75 (BaseOrchestrator routing responsibilities clearly defined in base.ts)
- k_002: 0.68 (Registry is window-specific and hardcodes provider in target_registry.ts)
- k_003: 0.66 (llm_job_service + llm_batch_service hardwire window applyRequestResult)
- k_004: 0.62 (Evidence ingestion + stage progression gaps visible in window_service/window_repo)
- k_005: 0.58 (Refactor-everything stage workflow + scheduler separation noted; less direct)

## Hypothesis Scores
- h_A_01_001: 0.63 (Registry split and apply-result routing gap supported by k_002/k_003)
- h_A_02_001: 0.64 (Missing ingestion + stage chaining supported by k_004)
- h_A_03_001: 0.55 (Pattern reuse plausible but less definitive from k_005)

## Step Scores
- S1: 0.60 (Registry contract aligns with current coupling)
- S2: 0.57 (Key normalization plausible, depends on stable prefixes)
- S3: 0.59 (Ingestion mutation is straightforward, scoped)
- S4: 0.52 (Stage progression may be tricky under concurrency)
- S5: 0.50 (End-to-end test depends on scheduler + provider setup)
