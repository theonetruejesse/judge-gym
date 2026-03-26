# Final Report: V4 Launch Campaign

## Terminal Objective

Execute the locked V4 wave-1 study end to end: import Gilardi and Zheng into Convex, register paper-audit packages, create the headline experiments, run canaries, monitor stability, and continue iterating until the V4 launch cohort is scientifically and operationally ready.

## Environment Summary

- The locked V4 spec remained stable during execution.
- Convex own-dev, the deployed Railway worker, and the live provider/runtime stack were all healthy enough to support real canary launches.
- The only launch blocker surfaced was local to `scripts/v4/apply_bundle.ts`, not to Convex, Temporal, or Railway.

## Progression Strategy

- Start with the smallest live paper-audit launches that exercise the real stack.
- Promote only after baseline canaries complete with zero failures and healthy task-queue state.
- Treat any canary failure as a tooling or contract bug until proven otherwise, then patch narrowly and retry.

## Current Best

- `baseline_live_canaries_passed`
- Gilardi, Zheng single-turn, and Zheng multi-turn baseline canaries all completed live with zero failures.
- The next justified step is the full V4 matrix launch campaign.

## Next Handoff

- `R02`: instantiate the locked V4 headline matrix, launch the first cohort cells, and apply the same monitored promotion/prune loop at matrix scale.
