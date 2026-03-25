# Final Report: V4 Implementation Readiness

## Terminal Objective

Implement everything needed to execute the locked V4 study end to end, leaving only the final live API calls to create experiments, import data into Convex, and launch scrape or run jobs.

## Environment Summary

- The repo already had the greenfield V4 substrate: evidence universes, evidence sets, source records, semantic views, transform runs, evidence-set-backed experiments, and provider-aware routing.
- The missing execution surface was package-driven paper audits, target-local source acquisition, target-specific import builders, Qwen OpenRouter policy, and a canary path that stopped before live Convex mutations.

## Progression Strategy

- Implement a first-class `paper_audit_packages` registry and bind experiments to packages.
- Make runtime prompt building and parser behavior package-aware without rewriting the stage graph.
- Fetch real Gilardi and Zheng artifacts locally under `_local/`.
- Build local import bundles and canary bundles for both targets.
- Validate that dry-run canaries succeed and only live import / experiment creation calls remain.

## Current Best

- `paper_audit_packages` exists in Convex schema and package-aware experiments can pre-seed direct-label rubric artifacts.
- Gilardi source artifacts are fetched from Harvard Dataverse into `_local/v4_sources/gilardi/`.
- Zheng source artifacts are fetched from FastChat and Hugging Face into `_local/v4_sources/zheng/`.
- Local builders emit ready-to-apply bundles under `_local/v4_builds/gilardi/` and `_local/v4_builds/zheng/`.
- Dry-run canaries succeed for:
  - `bun run v4:canary:gilardi`
  - `bun run v4:canary:zheng`
  - `bun run v4:canary:zheng --multi-turn`
- Remaining work is limited to live Convex API calls that create the universes, evidence sets, paper-audit packages, experiments, and optional canary runs.

## Next Handoff

- If execution is desired, run the canary scripts with `--live` and optionally `--start-run`.
- After live canaries, apply the full target bundles and instantiate the locked V4 matrix.
