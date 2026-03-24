# V3 Repeatability Sanity Validation

## Outcome

Relaunch gate is `go`.

No additional pre-rerun patch is justified from the current evidence. The validated full V3 cohort is still complete and scientifically valid, Temporal queues are healthy and idle, and the current bug ledger contains only fixed or validated-live blocker families.

## What Counts As Success

The next sanity rerun should be treated as validated for this turn once it proves three things:

1. launch integrity for all 18 manifest experiments
2. under-35 direct-policy correctness on representative 30-target stages
3. score-stage repeatability through first provider batch submission without the old timeout family recurring

## Minimal Scaffolding

- Reset from `complete` back to `preflight_clean`
- Confirm `launch_ready = true`, all 18 experiments in `start`, and queue readiness
- Relaunch in manifest `full` mode
- Monitor representative runs through early `score_gen`
- Stop and capture forensics immediately if a prior blocker family recurs

## Patch Decision

- Blocking pre-rerun patches: none
- Non-blocking backlog remains:
  - `v3_failed_apply_output_capture`
  - `window_raw_semantic_split_followup`

Those should remain trigger-based follow-ups, not speculative pre-rerun work.
