# Certainty Report

## Evidence Scores
- k_001: 0.88 — README documents the manual CLI workflow and payload structure; uncertainty from doc/code drift and external prerequisites.
- k_002: 0.93 — ExperimentConfigSchema explicitly enumerates required fields and evidence_view enum.
- k_003: 0.90 — Scoring seed enforces rubric parsed, evidence present, and uses sample_count/evidence_limit.
- k_004: 0.90 — insertEvidenceBatch accepts and stores neutralized_content.
- k_005: 0.86 — evidence workflows directory is empty; possible external tooling.
- k_006: 0.88 — Lab bootstrapping is gated by LAB_BOOTSTRAP/NEW_RUN and uses static EXPERIMENT_SETTINGS.
- k_007: 0.82 — OpenAI batch adapter throws without OPENAI_API_KEY; depends on provider routing.
- k_008: 0.87 — Lab supervisor loop submits/polls batches via Convex lab actions.
- k_009: 0.89 — scoring prompt falls back to raw_content when configured view missing.

## Hypothesis Scores
- h_A1_001: 0.62 — Manual CLI flow exists, but requires evidence, parsed rubric, and batch supervisor loop.
- h_A2_001: 0.66 — Lab TUI lacks explicit run creation controls; env flags + static settings.
- h_A3_001: 0.48 — Neutralization not automated, but scoring can fall back to raw.
- h_A4_001: 0.65 — OpenAI key required for gpt-4.1 via batch adapter.

## Step Scores
- S1: 0.60 — Env readiness depends on actual key availability and Convex connectivity.
- S2: 0.55 — Orchestration decision + TUI cleanup involves product/UX choices.
- S3: 0.70 — Trial settings are configurable via lab or CLI; model availability is the main risk.
- S4: 0.55 — Evidence ingestion and neutralization are manual without workflows.
- S5: 0.58 — Pipeline is wired but depends on evidence, rubric parse, and supervisor batch loop.
- S6: 0.62 — Output queries exist but rely on prior steps succeeding.
