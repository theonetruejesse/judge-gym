# Final Report: Infra Readiness Hardening

## Terminal Objective

Harden judge-gym infra for V4 launch by moving Media Cloud acquisition to the Temporal execution plane, validating full smoke/screen coverage, clearing irrelevant Convex and Railway state, and simplifying Railway bootstrap/linking so contributors can provision the stack from scratch.

## Environment Summary

- Convex own-dev and the lab are now agent-owned through `bun dev`, with Convex repeatedly pushed until the live validator matched the local schema.
- Media Cloud discovery and URL hydration now execute on the Railway-hosted Temporal worker instead of inside Convex actions.
- Railway project `sincere-freedom` is live with the official Temporal template services, Redis, and the repo-managed `engine-temporal-worker`.

## Progression Strategy

- Correct execution-plane ownership first.
- Prove the migrated path with the narrowest live smoke possible.
- Reset transient smoke data after proof, then simplify the contributor bootstrap so the repo can re-target Railway without hidden state.

## Current Best

- Best candidate: Temporal-owned Media Cloud acquisition with bounded smoke control, live worker verification, and auto-linking Railway bootstrap scripts.
- Evidence:
  - `bun run infra:smoke:acquisition --page-size 1 --max-pages 1 --timeout-ms 180000 --snapshot-set` completed successfully live.
  - Railway worker deployment `2e1471e0-1f98-4f4b-8921-16fe3fcc1995` is `SUCCESS`, and deploy logs show the `judge-gym.run` worker entering `RUNNING`.
  - Convex own-dev reset now dry-runs at zero rows across evidence and run tables.

## Next Handoff

- Infra hardening is complete.
- The next campaign should be the V4 launch/canary loop on top of the cleaned infra substrate.
