# Final Report: V4 Launch R01

## Objective

Execute the first live V4 launch loop: apply Gilardi and Zheng bundles into Convex, register paper-audit packages, create and launch baseline canary experiments, monitor their behavior, and write explicit promotion gates for moving from canaries to full headline matrix instantiation.

## Workflow Summary

- Objective class: `live_launch_execution`
- Operating mode: `live_ops_with_patch`
- Execution mode: `compile_and_execute`

## Findings

- The first live launch blocker was local to `scripts/v4/apply_bundle.ts`: import blueprints leaked metadata fields (`experiment_tag`, then `package_tag`) into `experiment_config`, which the live Convex validator correctly rejected.
- Tightening `apply_bundle.ts` to explicitly construct `experiment_config` fixed the live launch path without widening the experiment schema.
- The Gilardi baseline canary completed end to end on the live stack with `6/6` score targets completed and no failures.
- The Zheng single-turn baseline canary completed end to end on the live stack with `13/13` score targets completed and no failures.
- The Zheng multi-turn baseline canary completed end to end on the live stack with `12/12` score targets completed and no failures.
- Live queue health stayed ready while the canaries were running, so the worker/Temporal path is no longer the launch bottleneck.

## Decisions

- Treat the live canary launch path as validated and keep the experiment schema strict; fix launch tooling instead of relaxing validators.
- Promote the campaign from `pre-launch runtime ready` to `baseline live canaries passed`.
- Make the next bounded step the full V4 matrix instantiation and monitoring loop rather than more platform proving.

## Validation

- `python3 /Users/jesselee/.codex/skills/deep-workflow/scripts/validate_workflow.py _deep_workflows/v4-launch-r01`
- `python3 /Users/jesselee/.codex/skills/execute-workflow/scripts/bootstrap_execution.py _deep_workflows/v4-launch-r01`
- `python3 /Users/jesselee/.codex/skills/execute-workflow/scripts/run_workflow.py _deep_workflows/v4-launch-r01`
- `bun run typecheck`
- `bun run v4:canary:gilardi`
- `bun run v4:canary:gilardi --live --start-run`
- `bun run v4:canary:zheng --live --start-run`
- `bun run v4:canary:zheng --multi-turn --live --start-run`
