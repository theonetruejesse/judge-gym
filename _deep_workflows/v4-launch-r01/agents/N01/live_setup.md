# N01 Live Setup

## Objective

Apply the locked Gilardi and Zheng baseline bundles live, register paper-audit packages, launch the first canary runs, and verify end-to-end execution on Convex own-dev plus the deployed Railway worker.

## Live Execution

- Fixed `scripts/v4/apply_bundle.ts` so live experiment creation only forwards validator-accepted `experiment_config` fields.
- Launched `bun run v4:canary:gilardi --live --start-run`.
- Launched `bun run v4:canary:zheng --live --start-run`.
- Launched `bun run v4:canary:zheng --multi-turn --live --start-run`.

## Results

- `gilardi_relevance_v1_canary_gpt41`
  - run id: `kx7avsp2cq2qjk0rc8ake2372583m0b0`
  - status: `completed`
  - score targets: `6`
  - failures: `0`
- `zheng_mt_bench_pair_v2_v1_baseline_gpt41`
  - run id: `kx73p8xb8rqesc7c372fsbvkss83mh80`
  - status: `completed`
  - score targets: `13`
  - failures: `0`
- `zheng_mt_bench_pair_v2_multi_turn_v1_baseline_gpt41`
  - run id: `kx73wfdh880f7d8k8mgw8a6ywd83ncvf`
  - status: `completed`
  - score targets: `12`
  - failures: `0`

## Promotion Gates

- Promote to headline matrix instantiation only if:
  - baseline canaries complete on the live worker with zero stage failures,
  - task queue health stays ready during the run,
  - no parser-specific failures appear in `score_gen` or `score_critic`,
  - imported paper-audit packages remain stable under repeat launch.
- Current state: all gates satisfied for baseline expansion.

## Remaining Work

- Instantiate the full locked V4 matrix from `docs/pilots/v4_specs.md`.
- Add the broader provider panel cells and monitor them using the same run-summary and diagnostics ladder.
