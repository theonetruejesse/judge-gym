# Certainty Report

## Evidence Scores
- k_001: 0.73 (UI window editor directly calls initEvidenceWindowAndCollect)
- k_002: 0.70 (Home page evidence windows table wired to listEvidenceWindows)
- k_003: 0.72 (Evidence detail page depends on listEvidenceByWindow + getEvidenceContent)
- k_004: 0.68 (Refactor-everything lab.ts clearly exposes evidence endpoints)
- k_005: 0.66 (Integration tests show lab facade usage, but broader scope)
- k_006: 0.70 (Current branch has window flow primitives but empty lab.ts)

## Hypothesis Scores
- h_A_01_001: 0.62 (Evidence endpoints align with UI; minor uncertainties about reuse/status fields)
- h_A_02_001: 0.58 (Smoke tests feasible but depend on provider latency and scheduler)
- h_A_03_001: 0.40 (Challenged by experiment endpoints in existing UI/tests)

## Step Scores
- S1: 0.60 (Lab facade endpoints straightforward to implement)
- S2: 0.55 (UI porting is clear but may require trimming experiment sections)
- S3: 0.50 (End-to-end smoke tests can be flaky without stubs)
- S4: 0.45 (Stubbing experiments is a stopgap; unclear long-term)
- S5: 0.50 (Docs update is easy but needs ongoing maintenance)
