# Certainty Report

## Evidence Scores

- `k_001`: 0.90. Backed by direct code inspection of stage progression and request-target state logic.
- `k_002`: 0.94. Backed by repeated live control-plane snapshots, forensic artifacts, and representative target inspection.
- `k_003`: 0.79. Backed by official Convex docs, but still somewhat indirect because the docs describe platform constraints rather than this exact application bug.

## Hypothesis Scores

- `h_A_01_001`: 0.88. Strongly supported by current code and live state.
- `h_A_02_001`: 0.90. Strongly supported by exhausted target evidence and lack of recovery over time.
- `h_A_03_001`: 0.67. Plausible and supported by logs plus Convex limits, but secondary to the main terminal-policy bug.

## Step Scores

- `S1`: 0.93. Killing the current cohort after preserved forensics is well supported.
- `S2`: 0.95. Timeout classification patch is low risk and directly justified.
- `S3`: 0.88. Terminal policy patch is strongly supported, though exact terminal semantics need one product decision.
- `S4`: 0.66. Performance/refactor patch is likely helpful but should follow the policy fix unless profiling shows it is primary.
- `S5`: 0.84. Validation sequence is standard and grounded in prior campaign workflow.
