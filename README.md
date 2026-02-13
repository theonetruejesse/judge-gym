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
│   │   ├── convex/
│   │   │   ├── schema.ts          # Tables + zod schemas (snake_case)
│   │   │   ├── main.ts            # Public API — experiments + runs
│   │   │   ├── data.ts            # Public API — read queries for analysis
│   │   │   ├── llm_*              # Ledger tables: requests, messages, batches
│   │   │   ├── workflows/         # Batch queue/submit/poll/finalize + run state
│   │   │   ├── providers/         # OpenAI/Anthropic batch adapters
│   │   │   ├── rate_limiter/      # Provider tiers + usage accounting
│   │   │   ├── strategies/        # Config → behavior resolvers
│   │   │   └── prompts/           # LLM prompts
│   │
│   ├── lab/                       # Ink TUI + supervisor loop
│   │   └── src/
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

# Quick setup (requires bun, convex, uv)
./scripts/setup.sh

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

### Environment

The setup script creates `.env.local` at repo root and a `.env` symlink for
package scripts. Fill in your Convex URL:

```bash
CONVEX_URL=https://<your-deployment>.convex.cloud
```

---

## Design Space

An **experiment** is a single point in the design space. Each axis is independently configurable:

| Axis            | Config Field             | Values                                                                                                                           | Default                                 |
| :-------------- | :----------------------- | :------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------- |
| Model Family    | `model_id`               | `gpt-4.1`, `gpt-4.1-mini`, `gpt-5.2`, `claude-sonnet-4.5`, `claude-haiku-4.5`, `gemini-3.0-flash`, `grok-4.1-fast`, `qwen3-235b` | —                                       |
| Concept         | `window.concept`         | Free-form string (e.g., `"fascism"`, `"democratic backsliding"`)                                                                 | —                                       |
| Task Type       | `task_type`              | `ecc`, `control`, `benchmark`                                                                                                    | —                                       |
| Scoring Method  | `config.scoring_method`  | `freeform-suffix-single`, `freeform-suffix-subset`                                                                               | `freeform-suffix-subset`                |
| Scale Size      | `config.scale_size`      | `3`, `4`, `5`                                                                                                                    | `4`                                     |
| Evidence View   | `config.evidence_view`   | `raw` / `cleaned` / `neutralized` / `abstracted`                                                                                 | `neutralized`                           |
| Randomizations  | `config.randomizations`  | array of `anon-label`, `rubric-order-shuffle`, `hide-label-name`                                                                 | `["anon-label","rubric-order-shuffle"]` |
| Prompt Ordering | `config.prompt_ordering` | `rubric-first`, `evidence-first`                                                                                                 | `rubric-first`                          |
| Abstain Gate    | `config.abstain_enabled` | `true` / `false`                                                                                                                 | `true`                                  |
| Ground Truth    | `ground_truth`           | `{ source, value?, label? }` (only for `control` / `benchmark`)                                                                  | —                                       |

To run a new ablation, create experiment records with different parameter values. No code changes needed.
Evidence windows are defined by `window.startDate`, `window.endDate`, `window.country`, and `window.concept`, and are reused across experiments with the same window key.

---

## Running Experiments

All experiment operations are exposed via Convex public mutations and queries. Operate via the Convex dashboard, CLI, or MCP.

### Option A — Lab TUI (recommended)

1. Start Convex dev server in `packages/engine`.
2. From repo root, start the lab supervisor:

```bash
bun run lab
```

Optional flags:

```bash
LAB_BOOTSTRAP=1 NEW_RUN=1 bun run lab
```

### Option B — Manual workflow (CLI)

#### 1. Initialize window + experiment

```bash
npx convex run main:initExperiment '{
  "window": {
    "start_date": "2026-01-01",
    "end_date": "2026-01-31",
    "country": "USA",
    "concept": "fascism"
  },
  "experiment": {
    "experiment_tag": "pilot_fascism_gpt4.1",
    "model_id": "gpt-4.1",
    "task_type": "ecc",
    "config": {
      "scale_size": 4,
      "randomizations": ["anon-label", "rubric-order-shuffle"],
      "evidence_view": "neutralized",
      "scoring_method": "freeform-suffix-subset",
      "prompt_ordering": "rubric-first",
      "abstain_enabled": true
    }
  }
}'
# → returns windowId + experimentId (reused if they already exist)
```

#### 2. Create a run + queue work

```bash
# Create a run
npx convex run main:createRun \
  '{"experiment_tag":"pilot_fascism_gpt4.1"}'

# Queue rubric generation
npx convex run main:queueRubricGeneration \
  '{"experiment_tag":"pilot_fascism_gpt4.1"}'

# Queue scoring (N samples per evidence item)
npx convex run main:queueScoreGeneration \
  '{"experiment_tag":"pilot_fascism_gpt4.1","sample_count":5}'

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
- **Strategy resolvers.** Pure functions map config to concrete behavior. Workflows consume resolved strategies.
- **Deterministic computation is separated from LLM generation.** Verdict parsing, label randomization, and DST mass assignment are pure functions in `utils/`.
- **Ledger + batching.** All LLM requests and outputs flow through `llm_*` tables and provider batch adapters.
- **Stage-based workflows.** Each pipeline stage is a workflow with explicit run state and batch bookkeeping.

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

## Agentic Integrations

- [ ] todo: edit this section

The engine is designed to be operated from within Cursor via the Convex MCP server. See [`packages/engine/AGENTS.md`](./packages/engine/AGENTS.md) for the full agent instruction set including:

- Setup checklist
- Public mutation/query reference
- Workflow recipes
- Debug procedures

---

## License

OpenRAIL-S License
