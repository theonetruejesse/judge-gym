# judge-gym

_this is a generative artifact, need to update the implementation details_

An open-source LLM-as-Judge design space engine. Systematically explore how model family, rubric design, scoring method, and evidence presentation affect LLM evaluation of contested political concepts.

Inspired by [GraphGym](https://github.com/snap-stanford/GraphGym) (You et al., NeurIPS 2020) — a platform that explored 315,000 GNN designs across 32 tasks. judge-gym applies the same philosophy to LLM-as-Judge evaluation: define a design space, create experiments as config, and sweep.

Read [`paper.md`](./paper.md) for the research motivation and theoretical framework.

- [ ] todo: edit everything here lol

---

## Monorepo Structure

```
judge-gym/
├── packages/
│   ├── engine/                    # Convex backend — the design space engine
│   │   ├── convex/
│   │   │   ├── schema.ts          # Tables + indexes (including llm_* status/batch/job)
│   │   │   ├── main.ts            # Public API — orchestration triggers
│   │   │   ├── data.ts            # Public API — read queries for analysis
│   │   │   ├── repo.ts            # Internal CRUD
│   │   │   ├── agent_config.ts    # Shared usage handler + rate limit feedback
│   │   │   ├── domain/            # Domain logic (window, llm_calls, orchestrator)
│   │   │   │   ├── llm_calls/      # LLM request/job/batch repos
│   │   │   │   │   ├── llm_batch_repo.ts
│   │   │   │   │   ├── llm_job_repo.ts
│   │   │   │   │   └── llm_request_repo.ts
│   │   │   ├── orchestrator/      # Minimal scheduler + retry routing + workflows
│   │   │   │   └── process_workflows.ts # Workflow definitions (jobs + batches)
│   │   │   ├── domain/llm_calls/  # LLM request/batch/job repos
│   │   │   ├── rate_limiter/      # Provider tiers + rate limiter wiring
│   │   │   ├── agents/            # AbstractJudgeAgent base class
│   │   │   ├── strategies/        # Config → behavior resolvers (scoring, scale, evidence, ordering)
│   │   │   ├── platform/           # Provider integrations + rate limiting
│   │   │   │   ├── providers/      # OpenAI adapters + provider/model registry
│   │   │   │   │   ├── provider_types.ts # Provider/model registry (batchable + rate-limit key helpers)
│   │   │   │   │   └── provider_services.ts # Internal actions for chat + batch
│   │   │   ├── utils/             # Deterministic: verdict parser, label randomization, DST mass assignment
│   │   │   └── stages/            # Pipeline stages
│   │   │       ├── 1_evidence/    # W1: Scrape + neutralize (ECC/Control) or load (Benchmark)
│   │   │       ├── 2_rubric/      # W2: Generate + validate (ECC/Control) or load (Benchmark)
│   │   │       ├── 3_scoring/     # W3: Score evidence × rubric; W4: Rubric swap trials
│   │   └── src/                   # Automated runner + live tracker
│   │       ├── experiments.ts     # Experiment settings (window + config)
│   │       └── helpers/           # Convex clients, runner, tracker, console UI
│   │
│   └── analysis/                  # Python — statistical analysis + visualization
│       ├── pyproject.toml         # uv project config
│       ├── data/                  # Local exports from Convex
│       ├── notebooks/             # Jupyter: polarization, entrenchment, swap, regression
│       └── src/judge_gym/         # JSD, DST aggregation, OLS, data collection from Convex
│
├── paper.md                       # Working paper (theory + methodology)
└── turbo.json                     # Turborepo config
```

---

## Prerequisites

- [Bun](https://bun.sh/) (v1.1+)
- [uv](https://docs.astral.sh/uv/) (for Python analysis package)
- A [Convex](https://convex.dev/) account (free tier works for development)

### API Keys

Set these in your Convex deployment environment:

| Key                  | Required | Used By                              |
| :------------------- | :------- | :----------------------------------- |
| `OPENAI_API_KEY`     | Yes      | GPT-4.1, GPT-4.1 Mini, GPT-5.2       |
| `ANTHROPIC_API_KEY`  | Yes      | Claude Sonnet 4.5, Claude Haiku 4.5  |
| `FIRECRAWL_API_KEY`  | Yes      | Evidence collection (news scraping)  |
| `XAI_API_KEY`        | Optional | Grok 4.1 Fast                        |
| `GOOGLE_API_KEY`     | Optional | Gemini 3.0 Flash                     |
| `OPENROUTER_API_KEY` | Optional | OpenRouter models (e.g., Qwen3 235B) |

---

## Setup

```bash
# Clone
git clone https://github.com/your-org/judge-gym.git
cd judge-gym

# Install dependencies (bun workspaces)
bun install

# Start Convex dev server (in a separate terminal)
cd packages/engine
bun run dev

# Set environment variables via Convex dashboard or CLI
npx convex env set OPENAI_API_KEY sk-...
npx convex env set ANTHROPIC_API_KEY sk-ant-...
npx convex env set FIRECRAWL_API_KEY fc-...

# Set up Python analysis environment
cd packages/analysis
uv sync
```

### Runner Environment

The automated runner in `packages/engine/src/` uses the Convex HTTP API.
Create `packages/engine/.env.local` with:

```bash
CONVEX_URL=https://<your-deployment>.convex.cloud
```

---

## Design Space

An **experiment** is a single point in the design space. Each axis is independently configurable:

| Axis            | Config Field            | Values                                                                                                                           | Default                                 |
| :-------------- | :---------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| Model Family    | `modelId`               | `gpt-4.1`, `gpt-4.1-mini`, `gpt-5.2`, `claude-sonnet-4.5`, `claude-haiku-4.5`, `gemini-3.0-flash`, `grok-4.1-fast`, `qwen3-235b` | —                                       |
| Concept         | `window.concept`        | Free-form string (e.g., `"fascism"`, `"democratic backsliding"`)                                                                 | —                                       |
| Task Type       | `taskType`              | `ecc`, `control`, `benchmark`                                                                                                    | —                                       |
| Scoring Method  | `config.scoringMethod`  | `freeform-suffix-single`, `freeform-suffix-subset`                                                                               | `freeform-suffix-subset`                |
| Scale Size      | `config.scaleSize`      | `3`, `4`, `5`                                                                                                                    | `4`                                     |
| Evidence View   | `config.evidenceView`   | `raw` / `cleaned` / `neutralized` / `abstracted`                                                                                 | `neutralized`                           |
| Randomizations  | `config.randomizations` | array of `anon-label`, `rubric-order-shuffle`, `hide-label-name`                                                                 | `["anon-label","rubric-order-shuffle"]` |
| Prompt Ordering | `config.promptOrdering` | `rubric-first`, `evidence-first`                                                                                                 | `rubric-first`                          |
| Abstain Gate    | `config.abstainEnabled` | `true` / `false`                                                                                                                 | `true`                                  |
| Ground Truth    | `groundTruth`           | `{ source, value?, label? }` (only for `control` / `benchmark`)                                                                  | —                                       |

To run a new ablation, create experiment records with different parameter values. No code changes needed.
Evidence windows are defined by `window.startDate`, `window.endDate`, `window.country`, and `window.concept`, and are reused across experiments with the same window key.

---

## Running Experiments

All experiment operations are exposed via Convex public mutations and queries. Operate via the Convex dashboard, CLI, or MCP from within Cursor.

### Option A — Automated runner (recommended)

1. Edit `packages/engine/src/experiments.ts` with your experiment settings.
2. Ensure `packages/engine/.env.local` has `CONVEX_URL=...` for your deployment.
3. Run the runner from `packages/engine/`:

```bash
bun run start
```

Runner flags are environment variables:

```bash
NEW_RUN=1 bun run start       # suffix experiment tags with timestamp
AUTO_ADVANCE=0 bun run start  # only track, do not auto-advance stages
ONCE=1 bun run start          # render once and exit
```

### Option B — Manual job (CLI)

#### 1. Initialize window + experiment

```bash
npx convex run main:initExperiment '{
  "window": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "country": "USA",
    "concept": "fascism"
  },
  "experiment": {
    "experimentTag": "pilot_fascism_gpt4.1",
    "modelId": "gpt-4.1",
    "taskType": "ecc",
    "config": {
      "scaleSize": 4,
      "randomizations": ["anon-label", "rubric-order-shuffle"],
      "evidenceView": "neutralized",
      "scoringMethod": "freeform-suffix-subset",
      "promptOrdering": "rubric-first",
      "abstainEnabled": true
    }
  }
}'
# → returns windowId + experimentId (reused if they already exist)
```

#### 2. Run the pipeline

```bash
# W1: Collect + neutralize evidence
npx convex run main:startEvidencePipeline \
  '{"windowId":"<windowId>","experimentTag":"pilot_fascism_gpt4.1","limit":15}'

# W2: Generate rubric
npx convex run main:startRubricGeneration \
  '{"experimentTag":"pilot_fascism_gpt4.1","samples":5}'

# W3: Score (5 samples per evidence item)
npx convex run main:startScoringTrial \
  '{"experimentTag":"pilot_fascism_gpt4.1","samples":5}'

# W4: Rubric swap (optional — for high-divergence pairs)
npx convex run main:startSwapTrial \
  '{"experimentTag":"pilot_fascism_gpt4.1","swapRubricFrom":"claude-sonnet-4.5"}'

```

#### 3. Query results

```bash
# Experiment summary
npx convex run data:getExperimentSummary \
  '{"experimentTag":"pilot_fascism_gpt4.1"}'

# Scores (raw + decoded)
npx convex run data:listExperimentScores \
  '{"experimentTag":"pilot_fascism_gpt4.1"}'

# Export for analysis
npx convex run data:exportExperimentCSV \
  '{"experimentTag":"pilot_fascism_gpt4.1"}'
```

---

## Pipeline Stages

| Stage | Name        | What It Does                                                                                                                                              | Key Agent        |
| :---- | :---------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------- |
| W1    | Evidence    | Scrape news (ECC/Control) or load curated data (Benchmark). Optionally neutralize tone.                                                                   | Neutralizer      |
| W2    | Rubric      | Generate $n$-stage evaluative rubric (ECC/Control) or load pre-defined rubric (Benchmark). Validate with critic.                                          | Rubricer, Critic |
| W3    | Scoring     | Score each evidence item against rubric, multiple times with varying random seeds. Strategy-driven: suffix parsing, label randomization, prompt ordering. | Scorer           |
| W4    | Rubric Swap | Re-score evidence using a rival model's rubric. Tests framework sensitivity.                                                                              | Scorer           |
| W5    | Probe       | Epistemic probing runs inline during scoring and is stored on each score row.                                                                             | Prober           |

---

## Architecture Principles

- **Experiments are data, not code.** Every ablation is a config record. No code changes to run new experiments.
- **Strategy resolvers.** Pure functions map config to concrete agent behavior. Agents never read raw config — they consume resolved strategies.
- **Deterministic computation is separated from LLM generation.** Verdict parsing, label randomization, and DST mass assignment are pure functions in `utils/`. Models generate text; functions extract structure.
- **Abstract agent base class.** All agents share: thread lifecycle, rate limiting, usage tracking, model resolution.
- **Stage-based modules.** Each pipeline stage is self-contained: job, steps, agent, and prompts colocated in one directory.
- **Single-store agent threads.** `@convex-dev/agent` is the source of truth for all LLM interactions. Tables store lean derived records with `threadId` backlinks.

---

## Analysis Package

The Python analysis package lives in `packages/analysis/` and operates on data exported from the engine.

```bash
cd packages/analysis
uv sync
uv run jupyter lab
```

### Notebooks

| Notebook                | Purpose                                                            |
| :---------------------- | :----------------------------------------------------------------- |
| `01_polarization.ipynb` | JSD across model families, score distribution heatmaps             |
| `02_entrenchment.ipynb` | Entrenchment Index ($P \times \text{Prob}_{expert}$), DST conflict |
| `03_swap.ipynb`         | Swap sensitivity analysis, confidence collapse detection           |
| `04_regression.ipynb`   | OLS: Score ~ Model + RubricQuality + Concept                       |

### Key Modules

| Module               | What It Does                                                                                |
| :------------------- | :------------------------------------------------------------------------------------------ |
| `collect.py`         | Pull data from Convex via HTTP API into pandas DataFrames                                   |
| `metrics.py`         | JSD, Entrenchment Index, Swap Sensitivity                                                   |
| `dempster_shafer.py` | DST mass assignment, Dempster's rule combination, belief/plausibility, cross-model conflict |
| `regression.py`      | OLS regression models                                                                       |

---

## Adding a New Ablation Axis

To add a new design space dimension (e.g., `promptLanguage: "english" | "formal-academic" | "simplified"`):

1. **Schema** — Add the field to `experiments.config` in `convex/schema.ts`
2. **Strategy** — Create `convex/strategies/language.strategy.ts` (pure function: config → typed behavior)
3. **Resolve** — Add to `convex/strategies/resolve.ts`
4. **Consume** — Read from `this.strategies.language` in the agent that cares

**Files touched: 3.** No job changes, no prompt surgery, no agent logic changes.

---

## Agentic Integrations

- [ ] todo: edit this section

The engine is designed to be operated from within Cursor via the Convex MCP server. See [`packages/engine/AGENTS.md`](./packages/engine/AGENTS.md) for the full agent instruction set including:

- Setup checklist
- Public mutation/query reference
- Job recipes
- Debug procedures

---

## License

OpenRAIL-S License
