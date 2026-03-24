# Final Report: V4 Full Implementation Plan

## Objective

Compile a full deep-workflow implementation plan for judge-gym V4 as a greenfield rebuild that lands Media Cloud-centered acquisition, the V4 evidence substrate, prompt/config generalization, provider/runtime abstraction, observability, testing, and the actual V4 experiment setup, with Media Cloud API verification gated on a user-provided key.

## Workflow Summary

- Objective class: `greenfield_rebuild_execution_planning`
- Operating mode: `live_ops_with_patch`
- Execution mode: compile_only

## Execution Doctrine

- Build the full target architecture, not a compatibility bridge.
- Start the real implementation run with an agent-owned root `bun dev` session and keep that session as the canonical runtime log surface.
- Implement in dependency order and make tests/observability first-class alongside feature work.
- Keep the actual V4 experiment setup as the final epic.
- Pause only for the Media Cloud API key before live acquisition verification.

## Epic Order

### Epic 0: Dev Bootstrap And Execution Loop

- Start root `bun dev`.
- Keep the dev session agent-owned for logs and runtime observation.
- Use the recurring validation loop:
  - patch
  - `bun run validate:convex`
  - `bun run typecheck`
  - targeted tests
  - smoke test when an epic boundary changes

### Epic 1: Acquisition And Evidence Domain

Build:

- `DiscoveryProvider`
- `MediaCloudDiscoveryProvider`
- `ContentFetcher`
- first-party URL hydration pipeline
- evidence universes
- evidence sources
- acquisition runs
- evidence candidates
- evidence items
- evidence views
- bundle grouping metadata

Required validation:

- query construction tests
- pagination tests
- candidate normalization fixtures
- hydration/extraction fixtures
- schema/repository tests
- integration test for `discover -> hydrate -> persist`

### Epic 2: Generic Experiment And Stage Engine

Build:

- V4 experiment schema
- task family model
- adjudication task model
- rubric source model
- scoring/output contract model
- generic stage runner
- stage artifact persistence

Required validation:

- config validation tests
- stage-plan compilation tests
- parser/output-contract tests
- multi-stage orchestration tests
- fixture runs for rubric, direct coding, and replay-style stages

### Epic 3: Provider Runtime Layer

Build:

- provider registry
- capability matrix
- normalized transport adapter interface
- Anthropic adapter
- OpenRouter adapter
- retry/quota/concurrency policy layer

Required validation:

- adapter contract tests
- output normalization tests
- usage accounting tests
- failure/retry tests
- capability gating tests

### Epic 4: Observability And Operator Surfaces

Build:

- process traces for discovery, hydration, stage execution, and provider calls
- acquisition diagnostics
- provider diagnostics
- stage diagnostics
- reproducibility artifacts
- smoke and debug commands for the V4 path

Required validation:

- trace emission tests
- diagnostics query tests
- failure-mode tests
- tiny end-to-end smoke covering acquisition plus one staged run

### Epic 5: Actual V4 Experiment Setup

Only after Epics 1 through 4 are green:

- import the flagship target
- create bundle plans
- create run manifests
- wire analysis outputs and paper assets
- run the first real V4 experiment

Required validation:

- target-import dry run
- manifest validation
- study matrix sanity checks
- tiny-subset end-to-end run
- only then full experiment execution

## Media Cloud Gate

Execution policy:

1. implement Media Cloud discovery against fixtures first
2. request the Media Cloud key
3. verify live discovery and pagination
4. only then enable live acquisition tests in the normal dev loop

## Stop Conditions

- Do not start the experiment epic if any earlier epic still depends on mocks instead of real observability or validation.
- Do not merge provider work without adapter contract tests.
- Do not merge acquisition work without fixture coverage and a live-verification plan.
- Do not start full experimental runs until the tiny-subset smoke run is green.
