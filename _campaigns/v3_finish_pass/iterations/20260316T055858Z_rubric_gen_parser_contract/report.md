# V3 Finish Pass Iteration 20260316T055858Z_rubric_gen_parser_contract

- Manifest version: `1`
- Launch mode: `full` (`target_count=30`, `pause_after=null`)
- Expected cohort size: `22` experiments
- Observed campaign state: `scientifically_invalid`
- Scientific validity: `scientifically_invalid_parser`
- Dominant failure domain: `parser_contract`
- Safe-heal attempted: `no`

## Summary

The current full dev pass is no longer failing on the heavy-family `rubric_critic -> score_gen` handoff. Multiple `600`-target runs reached `score_gen`, which validates the previous chunked asynchronous handoff fix in commit `585ff8b`.

The new blocker is a parser-contract failure in `rubric_gen`. Run `kh74skmag0d54p3eyrndzw342n830a3f` (`v3_b1_gpt_4_1_mini_abstain_true`) exhausted one sample after three attempts because the generated rubric repeatedly produced a stage with only `2` criteria, violating the parser contract in `run_parsers.ts`.

## Expected Vs Observed

- Expected: `22/22` runs remain scientifically usable while progressing through the full four-stage loop.
- Observed: `21` runs are still running, `1` run is already `error`, `0` completed.
- Stage split at capture time:
  - `rubric_gen`: `2`
  - `rubric_critic`: `10`
  - `score_gen`: `10`
  - `score_critic`: `0`

## Failed Run Evidence

- Experiment tag: `v3_b1_gpt_4_1_mini_abstain_true`
- Run id: `kh74skmag0d54p3eyrndzw342n830a3f`
- Current stage: `rubric_gen`
- Artifact counts:
  - `samples=30`
  - `rubrics=29`
  - `rubric_critics=0`
  - `sample_score_targets=600`
- Terminal failed target summary:
  - `rubric_gen`: `1` failed sample (`sample_ordinal=22`)
- Failed attempts on the same target:
  - attempt `1`: `Invalid criteria count (2) for stage "Strong and Extensive Signal"`
  - attempt `2`: `Invalid criteria count (2) for stage "Clear but Limited Pattern"`
  - attempt `3`: `Invalid criteria count (2) for stage "Extensive or Overt Signal"`

## Assessment

This is not a transport stall and not a recurrence of the earlier heavy handoff rollback. The run failed because the rubric parser enforces `3..5` criteria per stage, while the model can still emit structurally valid stage lines with only `2` criteria despite the prompt requirement.

The next patch should target the parser-contract boundary:

1. Inspect the exact failed outputs to distinguish true two-criterion generation from parser splitting issues.
2. Patch the smallest safe fix, likely a rubric parser normalizer or a stricter corrective retry path.
3. Validate, commit, then wipe and relaunch the full dev cohort.

## Validation

- Validation outcome: `passed`
- Commands:
  - `bun run validate:convex`
  - `cd packages/engine && bun run test -- convex/tests/run_parsers.test.ts convex/tests/run_prompts.test.ts convex/tests/llm_request_repo.test.ts`
- Commit hash: `pending`
