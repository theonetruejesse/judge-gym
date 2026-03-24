# V3 Engine Stability Signoff

## Proposal

This workflow should be executed as a compile-only stability program focused on four remaining areas:

1. define per-work-unit retry semantics as a first-class engine-settings contract
2. add deterministic fault injection for targeted chaos validation
3. close the remaining observability and forensic gaps that block confident diagnosis at scale
4. define the exact signoff matrix that must pass before calling the engine stable

## Why Now

The engine is past the broad migration phase. Current evidence suggests the remaining work is narrow:

- operational recovery and stage progression are much healthier
- the historical score-stage timeout family appears fixed
- but a single target can still fail terminally without consuming the desired retry budget
- and some target-level forensic surfaces still strain read limits

That means unstructured patching will create churn. The next phase should be one explicit closure program with a hard signoff bar.

## Expected Output

The execution of this workflow should produce:

- a retry settings contract
- a deterministic chaos harness plan
- a full signoff test matrix
- a prioritized patch roadmap

It should not patch or relaunch anything on its own.
