---
name: judge-gym build plan
overview: Build the 4 workflow stages (evidence, rubric, scoring, probe) that form the core pipeline of judge-gym, then wire them into main.ts. Steps 1-6 and 8-10 of the blueprint are complete; this plan covers Step 7 (stages) and the final wiring.
todos:
  - id: stage-1-evidence
    content: Build stages/1_evidence/ — evidence.prompts.ts, evidence.agent.ts (Neutralizer), evidence.steps.ts (scrapeNews, neutralizeBatch, loadBenchmarkEvidence), evidence.workflow.ts (evidenceWorkflow)
    status: pending
  - id: stage-2-rubric
    content: Build stages/2_rubric/ — rubric.prompts.ts, rubric.agent.ts (Rubricer + Critic), rubric.steps.ts (generateRubric, validateRubric, loadBenchmarkRubric), rubric.workflow.ts (rubricWorkflow)
    status: pending
  - id: stage-3-scoring
    content: Build stages/3_scoring/ — scoring.prompts.ts, scoring.randomize.ts, scoring.agent.ts (Scorer), scoring.steps.ts (scoreEvidence), scoring.workflow.ts (scoringWorkflow + swapWorkflow)
    status: pending
  - id: stage-4-probe
    content: Build stages/4_probe/ — probe.prompts.ts, probe.agent.ts (Prober), probe.steps.ts (probeOneSample), probe.workflow.ts (probeWorkflow)
    status: pending
  - id: wire-main
    content: Wire main.ts — replace 5 stubbed workflow triggers with actual workflow.start() calls to the stage workflows
    status: pending
isProject: false
---

# judge-gym Build Plan

## Current State

Blueprint steps **1-6, 8-10 are complete**. The following are fully implemented and working:

- Monorepo scaffold (turbo + bun + uv)
- Schema with all 7 tables and indexes ([schema.ts](packages/engine/convex/schema.ts))
- Infrastructure: convex.config, utils/MODEL_MAP, workflow_manager, rate_limiter, agent_config, env validation
- All 6 strategy resolvers ([strategies/resolve.ts](packages/engine/convex/strategies/resolve.ts))
- Utility functions: verdict_parser, randomize, dst
- Abstract agent base class ([agents/abstract.ts](packages/engine/convex/agents/abstract.ts))
- CRUD repo layer ([repo.ts](packages/engine/convex/repo.ts))
- Public read queries ([data.ts](packages/engine/convex/data.ts))
- Public write stubs ([main.ts](packages/engine/convex/main.ts)) — `createWindow` and `createExperiment` work; 5 workflow triggers are stubbed
- Debug utilities ([debug.ts](packages/engine/convex/debug.ts))
- Analysis package: collect, metrics, dempster_shafer, regression modules all implemented
- AGENTS.md, .cursor/rules/convex_rules.mdc

**What remains: Step 7 (stages) + wiring main.ts.**

---

## Build Order

Each stage follows the same 4-file structure per the blueprint. Build sequentially because later stages depend on earlier data being present.

### Stage 1: Evidence (`stages/1_evidence/`) — W1

4 files to create. This stage scrapes news via Firecrawl, optionally neutralizes tone, and handles benchmark evidence loading.

- `evidence.prompts.ts` — `NEUTRALIZE_INSTRUCTIONS`, `neutralizePrompt()` (blueprint lines 1467-1488)
- `evidence.agent.ts` — `Neutralizer` class extending `AbstractJudgeAgent`, fixed to `gpt-4.1-mini` (blueprint lines 1436-1461). Uses `env.FIRECRAWL_API_KEY` from `convex/env.ts`
- `evidence.steps.ts` — 3 internal actions (blueprint lines 1362-1431):
  - `scrapeNews` — Firecrawl search, inserts evidence rows
  - `neutralizeBatch` — runs Neutralizer on each evidence item
  - `loadBenchmarkEvidence` — stub for benchmark task type
- `evidence.workflow.ts` — `evidenceWorkflow` via `workflow.define()` (blueprint lines 1308-1357). Branches on `taskType`: benchmark loads directly; ecc/control scrapes then optionally neutralizes

### Stage 2: Rubric (`stages/2_rubric/`) — W2

4 files to create. Generates evaluative rubrics per experiment, validates them with a critic agent.

- `rubric.prompts.ts` — `RUBRIC_GENERATION_INSTRUCTIONS`, `rubricGenerationPrompt()`, `CRITIC_INSTRUCTIONS`, `rubricCriticPrompt()` (blueprint lines 1692-1757)
- `rubric.agent.ts` — Two classes (blueprint lines 1600-1689):
  - `Rubricer` extends `AbstractJudgeAgent`, uses experiment model, calls `generateObject` with `RubricGenerationOutputSchema`
  - `Critic` extends `AbstractJudgeAgent`, fixed to `gpt-4.1-mini`, calls `generateObject` with `QualityStatsSchema`
- `rubric.steps.ts` — 3 internal actions (blueprint lines 1539-1596):
  - `generateRubric` — creates rubric via Rubricer
  - `validateRubric` — scores rubric via Critic, patches qualityStats
  - `loadBenchmarkRubric` — stub for benchmark task type
- `rubric.workflow.ts` — `rubricWorkflow` via `workflow.define()` (blueprint lines 1496-1534). Branches on `taskType`: benchmark loads directly; ecc/control generates then validates

### Stage 3: Scoring (`stages/3_scoring/`) — W3 + W4

5 files to create. The core scoring pipeline: resolves strategies, builds prompts, runs scorer, parses verdicts. Also handles rubric swap trials.

- `scoring.prompts.ts` — `SCORING_INSTRUCTIONS`, `buildScoringPrompt()` with rubric-first/evidence-first ordering (blueprint lines 1932-1995)
- `scoring.randomize.ts` — Re-export or thin wrapper around `utils/randomize.ts` `generateLabelMapping()` (blueprint lines 1998-2029)
- `scoring.agent.ts` — `Scorer` class extending `AbstractJudgeAgent` (blueprint lines 462-528):
  - Constructor takes `(modelId, config)`, calls `resolveAll(config)` once
  - `score()` method uses strategies for content field, prompt building, generateText vs generateObject branching, verdict parsing
- `scoring.steps.ts` — 1 internal action (blueprint lines 1866-1915):
  - `scoreEvidence` — constructs Scorer, generates label mapping if randomized, scores, creates sample record
- `scoring.workflow.ts` — 2 workflows (blueprint lines 1764-1860):
  - `scoringWorkflow` — iterates evidence x samples, calls `scoreEvidence` for each
  - `swapWorkflow` — same but uses a rubric from a different model (`isSwap: true`)

### Stage 4: Probe (`stages/4_probe/`) — W5

4 files to create. Measures epistemic calibration by probing models in fresh context.

- `probe.prompts.ts` — `PROBE_INSTRUCTIONS`, `probePrompt()` (blueprint lines 2174-2207)
- `probe.agent.ts` — `Prober` class extending `AbstractJudgeAgent` (blueprint lines 2112-2168):
  - Uses same model as scorer, fresh thread with `recentMessages: 0`
  - Parses probability from response text
- `probe.steps.ts` — 1 internal action (blueprint lines 2067-2107):
  - `probeOneSample` — resolves stage label from sample verdict, runs Prober, creates probe record
- `probe.workflow.ts` — `probeWorkflow` via `workflow.define()` (blueprint lines 2038-2061). Iterates non-abstained samples, probes each

### Wire main.ts

After all 4 stages are built, replace the 5 stubbed workflow triggers in [main.ts](packages/engine/convex/main.ts) with actual `workflow.start()` calls pointing to:

- `startEvidencePipeline` -> `evidenceWorkflow`
- `startRubricGeneration` -> `rubricWorkflow`
- `startScoringTrial` -> `scoringWorkflow`
- `startSwapTrial` -> `swapWorkflow`
- `startProbingTrial` -> `probeWorkflow`

---

## File Count Summary

- Stage 1 (evidence): 4 new files
- Stage 2 (rubric): 4 new files
- Stage 3 (scoring): 5 new files
- Stage 4 (probe): 4 new files
- main.ts: 1 file modified (replace stubs)
- **Total: 17 new files, 1 modified file**
