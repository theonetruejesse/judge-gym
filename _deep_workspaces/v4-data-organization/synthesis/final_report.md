# Final Report: V4 Data Organization

## Terminal Objective

Organize the current V4 data and result surfaces across paper-audit and native conceptual-study lanes, identify which conceptual setups are runnable now versus blocked on missing bundle/spec work, and leave the repo ready for a controlled next launch phase before broader provider expansion.

## Environment Summary

- The paper-audit V4 launch campaign is already complete enough to serve as a fixed baseline.
- Live own-dev contains 22 completed V4 experiments across Gilardi and Zheng, including canaries and GPT-4.1 reruns.
- Local source and build artifacts for Gilardi and Zheng are already present under `_local/v4_sources/` and `_local/v4_builds/`.
- The current request is to organize that state before broadening into native conceptual work or more provider families.

## Progression Strategy

- Baseline: export the live catalog and local artifacts into a repeatable machine-readable inventory.
- Probe: detect tag collisions, duplicate catalog rows, and multi-run experiment rows before new launch work.
- Promote: mark the workspace complete once the repo has a stable inventory command, a human-readable data split, and a concrete native conceptual queue.
- Prune: do not reopen broad provider work until a GPT-4.1-only native conceptual manifest is frozen.

## Current Best

- Best artifact: `docs/pilots/v4_data_inventory.md`
- Backing export: `_local/v4_inventory/live_inventory.json`
- Key conclusion: yes, native conceptual setups can run on the current engine, but they should start as a separate GPT-4.1-only lane with a new curated evidence universe and without clustering.

## Next Handoff

- `R02`: clean or formalize the duplicate Gilardi catalog rows if needed, then freeze the first GPT-4.1-only native conceptual manifest and evidence-universe creation plan.
