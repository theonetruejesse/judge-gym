# Certainty Report

## Evidence Scores
- k_001: 0.72 (Direct Lab usage sites and engine re-export)
- k_002: 0.70 (Single-definition evidence via repo search)
- k_003: 0.66 (Server loop + client overfetch visible)
- k_004: 0.68 (Direct calls to handler resolution and requeue)
- k_005: 0.67 (Stage progression implemented in services)
- k_006: 0.64 (Definition-only evidence, possible external usage)
- k_007: 0.62 (Schema fields/tables written, few read paths)
- k_008: 0.58 (Status lifecycle inference + no batch/job custom_key reads)
- k_009: 0.60 (Client/server validation mismatch)

## Hypothesis Scores
- h_A1_001: 0.62 (Strong definition-only evidence, weak external unknowns)
- h_A2_001: 0.58 (Clear overfetch; impact depends on actual data size)
- h_A3_001: 0.60 (Boundary leak visible; refactor complexity unknown)
- h_A3_002: 0.57 (Duplicate logic visible; consolidation risk unknown)
- h_A4_001: 0.55 (Write-only evidence; future analytics uncertain)

## Step Scores
- S1: 0.68 (Inventory and reference map is straightforward)
- S2: 0.61 (Boundary refactor design requires careful coordination)
- S3: 0.57 (Schema cleanup depends on stakeholder intent)
- S4: 0.60 (Lab query optimizations are clear but require UI changes)
