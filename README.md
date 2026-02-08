# judge-gym

An open-source LLM-as-Judge design space engine. Systematically explore how model family, rubric design, scoring method, and evidence presentation affect LLM evaluation of contested political concepts.

Inspired by [GraphGym](https://github.com/snap-stanford/GraphGym) (You et al., NeurIPS 2020) — a platform that explored 315,000 GNN designs across 32 tasks. judge-gym applies the same philosophy to LLM-as-Judge evaluation: define a design space, create experiments as config, and sweep.

Read [`paper.md`](./paper.md) for the research motivation and theoretical framework.

---

## Monorepo Structure

```
judge-gym/
├── packages/
│   ├── engine/                    # Convex backend — the design space engine
│   │   └── convex/
│   │       ├── schema.ts          # All tables: experiments, windows, evidence, rubrics, samples, probes, usage
│   │       ├── main.ts            # Public API — workflow triggers
│   │       ├── data.ts            # Public API — read queries for analysis
│   │       ├── repo.ts            # Internal CRUD
│   │       ├── agents/            # AbstractJudgeAgent base class
│   │       ├── strategies/        # Config → behavior resolvers (scoring, scale, evidence, ordering, probe)
│   │       ├── utils/             # Deterministic: verdict parser, label randomization, DST mass assignment
│   │       └── stages/            # Pipeline stages
│   │           ├── 1_evidence/    # W1: Scrape + neutralize (ECC/Control) or load (Benchmark)
│   │           ├── 2_rubric/      # W2: Generate + validate (ECC/Control) or load (Benchmark)
│   │           ├── 3_scoring/     # W3: Score evidence × rubric; W4: Rubric swap trials
│   │           └── 4_probe/       # W5: Fresh-window epistemic probes
│   │
│   └── analysis/                  # Python — statistical analysis + visualization
│       ├── pyproject.toml         # uv project config
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

| Key                  | Required | Used By                             |
| :------------------- | :------- | :---------------------------------- |
| `OPENAI_API_KEY`     | Yes      | GPT-4.1, GPT-4.1 Mini, o4-mini      |
| `ANTHROPIC_API_KEY`  | Yes      | Claude Sonnet 4, Sonnet 4.5         |
| `FIRECRAWL_API_KEY`  | Yes      | Evidence collection (news scraping) |
| `XAI_API_KEY`        | Optional | Grok 3                              |
| `GOOGLE_API_KEY`     | Optional | Gemini 2.5 Pro, Gemini 2.5 Flash    |
| `OPENROUTER_API_KEY` | Optional | Fallback / additional models        |

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
npx convex dev

# Set environment variables via Convex dashboard or CLI
npx convex env set OPENAI_API_KEY sk-...
npx convex env set ANTHROPIC_API_KEY sk-ant-...
npx convex env set FIRECRAWL_API_KEY fc-...

# Set up Python analysis environment
cd packages/analysis
uv sync
```

---

## Design Space

An **experiment** is a single point in the design space. Each axis is independently configurable:

| Axis                | Config Field                | Values                                                                                                       | Default                  |
| :------------------ | :-------------------------- | :----------------------------------------------------------------------------------------------------------- | :----------------------- |
| Model Family        | `modelId`                   | `gpt-4.1`, `claude-sonnet-4`, `claude-sonnet-4-5`, `grok-3`, `gemini-2.5-pro`, `gemini-2.5-flash`, `o4-mini` | —                        |
| Concept             | `concept`                   | Free-form string (e.g., `"fascism"`, `"democratic backsliding"`)                                             | —                        |
| Task Type           | `taskType`                  | `ecc`, `control`, `benchmark`                                                                                | —                        |
| Scoring Method      | `config.scoringMethod`      | `freeform-suffix-single`, `freeform-suffix-subset`, `structured-json`                                        | `freeform-suffix-subset` |
| Scale Size          | `config.scaleSize`          | `3`, `4`, `5`                                                                                                | `4`                      |
| Neutralize Evidence | `config.neutralizeEvidence` | `true` / `false`                                                                                             | `true`                   |
| Randomizations      | `config.randomizations`     | array of `anon-label`, `rubric-order-shuffle`, `hide-label-name`                                              | `["anon-label","rubric-order-shuffle"]` |
| Prompt Ordering     | `config.promptOrdering`     | `rubric-first`, `evidence-first`                                                                             | `rubric-first`           |
| Abstain Gate        | `config.abstainEnabled`     | `true` / `false`                                                                                             | `true`                   |
| Fresh-Window Probe  | `config.freshWindowProbe`   | `true` / `false`                                                                                             | `true`                   |

To run a new ablation, create experiment records with different parameter values. No code changes needed.

---

## Running Experiments

All experiment operations are exposed via Convex public mutations and queries. Operate via the Convex dashboard, CLI, or MCP from within Cursor.

### 1. Create a time window

```bash
npx convex run main:createWindow \
  '{"startDate":"2026-01-01","endDate":"2026-01-31","country":"USA"}'
# → returns windowId
```

### 2. Create an experiment

```bash
npx convex run main:createExperiment '{
  "experimentTag": "pilot_fascism_gpt4.1",
  "windowId": "<windowId>",
  "modelId": "gpt-4.1",
  "taskType": "ecc",
  "concept": "fascism",
  "config": {
    "scaleSize": 4,
    "randomizations": ["anon-label", "rubric-order-shuffle"],
    "neutralizeEvidence": true,
    "scoringMethod": "freeform-suffix-subset",
    "promptOrdering": "rubric-first",
    "abstainEnabled": true,
    "freshWindowProbe": true
  }
}'
```

### 3. Run the pipeline

```bash
# W1: Collect + neutralize evidence
npx convex run main:startEvidencePipeline \
  '{"windowId":"<windowId>","experimentTag":"pilot_fascism_gpt4.1","limit":15}'

# W2: Generate rubric
npx convex run main:startRubricGeneration \
  '{"experimentTag":"pilot_fascism_gpt4.1"}'

# W3: Score (5 samples per evidence item)
npx convex run main:startScoringTrial \
  '{"experimentTag":"pilot_fascism_gpt4.1","samples":5}'

# W4: Rubric swap (optional — for high-divergence pairs)
npx convex run main:startSwapTrial \
  '{"experimentTag":"pilot_fascism_gpt4.1","swapRubricFrom":"claude-sonnet-4-5"}'

# W5: Epistemic probes
npx convex run main:startProbingTrial \
  '{"experimentTag":"pilot_fascism_gpt4.1"}'
```

### 4. Query results

```bash
# Experiment summary
npx convex run data:getExperimentSummary \
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
| W5    | Probe       | In a fresh context window, ask the model for expert agreement probability.                                                                                | Prober           |

---

## Architecture Principles

- **Experiments are data, not code.** Every ablation is a config record. No code changes to run new experiments.
- **Strategy resolvers.** Pure functions map config to concrete agent behavior. Agents never read raw config — they consume resolved strategies.
- **Deterministic computation is separated from LLM generation.** Verdict parsing, label randomization, and DST mass assignment are pure functions in `utils/`. Models generate text; functions extract structure.
- **Abstract agent base class.** All agents share: thread lifecycle, rate limiting, usage tracking, model resolution.
- **Stage-based modules.** Each pipeline stage is self-contained: workflow, steps, agent, and prompts colocated in one directory.
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

**Files touched: 3.** No workflow changes, no prompt surgery, no agent logic changes.

---

## MCP Operation (Cursor)

The engine is designed to be operated from within Cursor via the Convex MCP server. See [`packages/engine/AGENTS.md`](./packages/engine/AGENTS.md) for the full agent instruction set including:

- Setup checklist
- Public mutation/query reference
- Workflow recipes
- Debug procedures

---

## License

MIT
