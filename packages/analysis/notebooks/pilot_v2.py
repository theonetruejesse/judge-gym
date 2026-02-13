# %% [markdown]
# # Pilot Study v2
#
# Multiple experiments (from `TAGS`) scoring news articles on a 4-point fascism rubric.
#
# Data is pulled via `judge_gym.collect.pull_experiments` (single bulk Convex query per experiment).

# %%
import ast
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from functools import reduce
from itertools import combinations
from pathlib import Path
from typing import Any

import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for script execution
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import statsmodels.formula.api as smf
from matplotlib.patches import Patch
from pyds import MassFunction
from scipy.spatial.distance import pdist

# ---------------------------------------------------------------------------
# Output directory & logging setup
# ---------------------------------------------------------------------------
OUTPUT_DIR = Path(__file__).parent.parent / "scripts" / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

LOG_PATH = OUTPUT_DIR / "run.log"

class _Tee:
    """Write to both the original stream and a log file."""
    def __init__(self, log_file, stream):
        self._log = log_file
        self._stream = stream
    def write(self, msg):
        self._stream.write(msg)
        self._log.write(msg)
    def flush(self):
        self._stream.flush()
        self._log.flush()

# Fresh log every run — truncate on open
_log_fh = open(LOG_PATH, "w")
sys.stdout = _Tee(_log_fh, sys.__stdout__)
sys.stderr = _Tee(_log_fh, sys.__stderr__)

_start_time = time.time()
print(f"=== pilot_v2.py  |  {time.strftime('%Y-%m-%d %H:%M:%S')}  ===")
print(f"Output dir: {OUTPUT_DIR}")
print()

def savefig(name: str, fig=None):
    """Save current figure to output dir and close it."""
    f = fig or plt.gcf()
    path = OUTPUT_DIR / f"{name}.png"
    f.savefig(path, dpi=150, bbox_inches="tight")
    plt.close(f)
    print(f"  [fig] {path.name}")

def display(obj):
    """Fallback for notebook display() calls — just print."""
    print(obj.to_string() if hasattr(obj, "to_string") else str(obj))

# %%
# TAGS = [
#     "ecc-fascism-usa-trial-gpt-4.1",
#     "ecc-fascism-usa-trial-gemini-3.0-flash",
#     "ecc-fascism-usa-trial-gpt-5.2-chat",
#     "ecc-fascism-usa-trial-qwen3-235b",
#     "ecc-fascism-usa-trial-gpt-4.1-mini",
# ]

# data = pull_experiments(TAGS)
# print(f"Tags pulled: {data.tags}")
# print(f"Scale size:  {data.scale_size}")
# print(f"Scores:      {len(data.scores)} rows")
# print(f"Evidence:    {len(data.evidence)} articles")

# %% [markdown]
# ## Evidence

# %%
CSV_PATH = "https://raw.githubusercontent.com/theonetruejesse/pilot-v2-data/main/experiments.csv"
TAGS = [
    "ecc-fascism-usa-trial-gpt-4.1",
    "ecc-fascism-usa-trial-gemini-3.0-flash",
    "ecc-fascism-usa-trial-gpt-5.2-chat",
    "ecc-fascism-usa-trial-qwen3-235b",
]


def _maybe_parse_json(val: Any) -> Any:
    if not isinstance(val, str):
        return val
    s = val.strip()
    if not s or s[0] not in "[{":
        return val
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return val


@dataclass
class ExperimentData:
    scores: pd.DataFrame
    evidence: pd.DataFrame
    rubrics: pd.DataFrame
    experiments: dict[str, dict[str, Any]]
    tags: list[str]

    @property
    def scale_size(self) -> int:
        return int(self.scores["scaleSize"].dropna().iloc[0])


df = pd.read_csv(CSV_PATH)
for col in ["decodedScores", "rubric.qualityStats", "rubric.stages"]:
    if col in df.columns:
        df[col] = df[col].apply(_maybe_parse_json)

# Scores
scores = df.copy()

# Evidence
if {"evidenceId", "evidenceLabel", "evidenceTitle"}.issubset(df.columns):
    evidence = (
        df[["evidenceId", "evidenceLabel", "evidenceTitle"]]
        .drop_duplicates(subset="evidenceId")
        .rename(columns={"evidenceLabel": "label", "evidenceTitle": "title"})
        .reset_index(drop=True)
    )
else:
    evidence = pd.DataFrame(columns=["evidenceId", "label", "title"])

# Rubrics
if {"rubricId", "rubric.qualityStats", "rubric.stages"}.issubset(df.columns):
    rubrics = (
        df[["rubricId", "rubric.qualityStats", "rubric.stages"]]
        .drop_duplicates(subset="rubricId")
        .rename(
            columns={"rubric.qualityStats": "qualityStats", "rubric.stages": "stages"}
        )
        .reset_index(drop=True)
    )
else:
    rubrics = pd.DataFrame(columns=["rubricId", "qualityStats", "stages"])

# Experiments (only modelId needed by notebook)
experiments = {}
if {"experimentTag", "experiment.modelId"}.issubset(df.columns):
    exp_df = (
        df[["experimentTag", "experiment.modelId"]]
        .drop_duplicates(subset="experimentTag")
        .rename(columns={"experiment.modelId": "modelId"})
    )
    experiments = exp_df.set_index("experimentTag").to_dict(orient="index")

# Tags (preserve TAGS order if present)
found_tags = [t for t in TAGS if t in set(df["experimentTag"].unique())]
if not found_tags:
    found_tags = sorted(df["experimentTag"].unique().tolist())

# Filter to TAGS if provided
scores = scores[scores["experimentTag"].isin(found_tags)].copy()

# Final container
data = ExperimentData(
    scores=scores,
    evidence=evidence,
    rubrics=rubrics,
    experiments=experiments,
    tags=found_tags,
)

print(f"Tags pulled: {data.tags}")
print(f"Scale size:  {data.scale_size}")
print(f"Scores:      {len(data.scores)} rows")
print(f"Evidence:    {len(data.evidence)} articles")


# %%
scores = data.scores.copy()
eid_to_label = dict(zip(data.evidence["evidenceId"], data.evidence["label"]))
scores["evidence"] = scores["evidenceId"].map(eid_to_label)

data.evidence[["label", "title"]]

# %% [markdown]
# ## Verdict vocabulary fingerprint
#
# A compact model-level "verdict alphabet" view:
# rows are raw verdict categories (powerset verdicts + ABSTAIN), columns are models,
# and values are overall frequencies across all evidence items.

# %%
# --- Figure 01: Verdict vocabulary fingerprint ---

tmp_vocab = scores.copy()
tmp_vocab["verdict"] = tmp_vocab.apply(
    lambda r: "ABSTAIN" if r["abstained"] else str(sorted(r["decodedScores"])),
    axis=1,
)

# Canonical verdict ordering: by center-of-gravity, then cardinality, then elements; ABSTAIN last
def _vocab_sort_key(col: str):
    if col == "ABSTAIN":
        return (999, 0, [])
    stages = ast.literal_eval(col)
    return (sum(stages) / len(stages), len(stages), stages)


all_verdicts_vocab = sorted(tmp_vocab["verdict"].unique(), key=_vocab_sort_key)
model_order = [data.experiments[tag]["modelId"] for tag in data.tags]

vocab_counts = (
    tmp_vocab.groupby(["verdict", "model"]).size().unstack(fill_value=0)
    if "model" in tmp_vocab.columns
    else None
)
if vocab_counts is None:
    tmp_vocab["model"] = tmp_vocab["experimentTag"].map(
        {tag: data.experiments[tag]["modelId"] for tag in data.tags}
    )
    vocab_counts = tmp_vocab.groupby(["verdict", "model"]).size().unstack(fill_value=0)

vocab_counts = vocab_counts.reindex(index=all_verdicts_vocab, columns=model_order, fill_value=0)
vocab_freq = vocab_counts.div(vocab_counts.sum(axis=0), axis=1).fillna(0.0)

fig, ax = plt.subplots(figsize=(8, max(6, 0.35 * len(all_verdicts_vocab))))
sns.heatmap(
    vocab_freq,
    ax=ax,
    cmap="mako_r",
    vmin=0,
    vmax=float(vocab_freq.max().max()) if len(vocab_freq) else 1.0,
    annot=True,
    fmt=".2f",
    annot_kws={"fontsize": 8, "fontweight": "bold"},
    linewidths=0.8,
    linecolor="white",
    cbar_kws={"label": "Frequency within model"},
)
ax.set_title("Verdict Vocabulary Fingerprint", fontsize=14, fontweight="bold")
ax.set_xlabel("")
ax.set_ylabel("Verdict category")
ax.tick_params(axis="x", rotation=20)
plt.tight_layout()
savefig("01_verdict_vocabulary")

# %% [markdown]
# ## Rubric stage length bias analysis
#
# Following Dubois et al. (2024), we test whether models exhibit systematic bias toward longer
# or shorter rubric stage descriptions. We run both pooled (across all rubrics) and per-rubric
# regressions to assess length effects.
#
# **Key finding**: Length bias is **highly heterogeneous across rubrics** — some rubrics show
# strong positive bias (prefer longer stages), others show strong negative bias (prefer shorter),
# with effects ranging from -0.29 to +0.30. The pooled effect averages to near-zero, masking
# this variation. Given this heterogeneity, we **do not apply a length discount** — any global
# correction would be arbitrary and could amplify bias in rubrics where the effect runs opposite
# to the average.
#
# ### Notes
# - Given Multiple testing: With 30 rubrics × 3 models = 90 tests, ~3 will be "significant" by chance at p < 0.05. Could use Bonferroni correction (p < 0.05/60 = 0.0008) Or FDR correction (less conservative).
# - Could use a signficance based adjustment when there's statistical evidence of length bias with per rubric, adjusted by direction.

# %%
# --- Rubric stage length bias regression ---

# Flatten rubric quality stats if present
rubrics = data.rubrics.copy()
if rubrics.empty:
    raise ValueError("No rubrics returned. Check Convex endpoint.")

if "qualityStats" in rubrics.columns:
    rubrics["observabilityScore"] = rubrics["qualityStats"].apply(
        lambda q: q.get("observabilityScore") if isinstance(q, dict) else np.nan
    )
    rubrics["discriminabilityScore"] = rubrics["qualityStats"].apply(
        lambda q: q.get("discriminabilityScore") if isinstance(q, dict) else np.nan
    )


def _word_count(text: str) -> int:
    """Count words in a text string."""
    tokens = re.split(r"\s+", (text or "").strip())
    return len([t for t in tokens if t])


def _stage_text(stage: dict) -> str:
    """Concatenate stage label + criteria into a single text string."""
    parts = [stage.get("label", "")]
    parts.extend(stage.get("criteria", []))
    return " ".join([p for p in parts if p])


# Build stage-level table: one row per rubric stage
stage_rows = []
for _, r in rubrics.iterrows():
    stages = r.get("stages") or []
    for idx, stage in enumerate(stages, start=1):
        stage_rows.append(
            {
                "rubricId": r["rubricId"],
                "stage": idx,
                "stage_len": _word_count(_stage_text(stage)),
                "observabilityScore": r.get("observabilityScore"),
                "discriminabilityScore": r.get("discriminabilityScore"),
            }
        )

stage_df = pd.DataFrame(stage_rows)

# Z-score stage length within each rubric
stage_df["stage_len_z"] = stage_df.groupby("rubricId")["stage_len"].transform(
    lambda s: (s - s.mean()) / s.std(ddof=0) if s.std(ddof=0) > 0 else 0.0
)

# Add score ID before expanding (so we can group back later)
scores["scoreId"] = scores.index

# Expand scores to score × stage rows for regression
score_stage = scores.merge(stage_df, on="rubricId", how="left")
score_stage["selected"] = score_stage.apply(
    lambda r: (
        0
        if r["abstained"] or r["decodedScores"] is None
        else int(r["stage"] in r["decodedScores"])
    ),
    axis=1,
)

# Fit stage-length bias per model (linear probability model)
# DV: selected (0/1), IV: stage_len_z + fixed effects for evidence + rubric quality
betas = {}
for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = score_stage[score_stage["experimentTag"] == tag].copy()
    sub = sub[~sub["abstained"]]  # exclude abstains from regression
    if sub.empty:
        betas[model] = 0.0
        continue
    formula = "selected ~ stage_len_z + C(evidence) + observabilityScore + discriminabilityScore"
    res = smf.ols(formula, data=sub).fit()
    betas[model] = float(res.params.get("stage_len_z", 0.0))
    print(
        f"{model}: stage_len_z beta = {betas[model]:.4f} (n={len(sub)}, p={res.pvalues.get('stage_len_z', np.nan):.4f})"
    )

# Rubric quality proxy and final adjusted probe
rubric_quality = (
    stage_df.groupby("rubricId")[["observabilityScore", "discriminabilityScore"]]
    .first()
    .reset_index()
)
scores = scores.merge(rubric_quality, on="rubricId", how="left")
scores["p_rubric"] = scores["observabilityScore"] * scores["discriminabilityScore"]
scores["p_score"] = scores["expertAgreementProb"]
scores["p_adjusted"] = scores["p_score"] * scores["p_rubric"]  # No length discount

# Per-rubric regressions to see heterogeneity in length bias
print("\n=== Per-rubric length bias regressions ===")

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = score_stage[score_stage["experimentTag"] == tag].copy()
    sub = sub[~sub["abstained"]]

    rubric_results = []
    for rubric_id in sub["rubricId"].unique():
        rubric_sub = sub[sub["rubricId"] == rubric_id].copy()

        # Need at least some variation to fit
        if rubric_sub["selected"].nunique() < 2 or len(rubric_sub) < 10:
            continue

        # Simple regression: selected ~ stage_len_z (no other controls, just length effect)
        try:
            formula = "selected ~ stage_len_z"
            res_rubric = smf.ols(formula, data=rubric_sub).fit()

            rubric_results.append(
                {
                    "rubricId": rubric_id,
                    "beta": res_rubric.params.get("stage_len_z", np.nan),
                    "pvalue": res_rubric.pvalues.get("stage_len_z", np.nan),
                    "n_obs": len(rubric_sub),
                    "n_selected": rubric_sub["selected"].sum(),
                }
            )
        except:
            continue

    rubric_df = pd.DataFrame(rubric_results)
    rubric_df["selection_rate"] = rubric_df["n_selected"] / rubric_df["n_obs"]

    print(f"\n--- {model} ---")
    print(f"Overall beta: {betas[model]:.4f}")
    print(f"Rubrics analyzed: {len(rubric_df)}")
    print(f"\nTop 10 rubrics by absolute beta (strongest length effects):")

    top_rubrics = rubric_df.sort_values("beta", key=abs, ascending=False).head(10)
    display(
        top_rubrics[["rubricId", "beta", "pvalue", "selection_rate", "n_obs"]]
        .style.format(
            {
                "beta": "{:.4f}",
                "pvalue": "{:.4f}",
                "selection_rate": "{:.3f}",
                "n_obs": "{:.0f}",
            }
        )
        .hide(axis="index")
    )

# %% [markdown]
# ## Abstain & specificity rates per evidence

# %%
# Abstain and singleton rates (uses scores + eid_to_label from regression cell above)


def rates_table(scores: pd.DataFrame) -> pd.DataFrame:
    """Per model: abstain % and singleton-commit % for each evidence.

    Columns use 'E1 (N=30)' notation so the sample size is in the header.
    Rows are multi-indexed: (model, metric).
    """
    labels = sorted(eid_to_label.values(), key=lambda l: int(l[1:]))

    records = []
    for tag in data.tags:
        sub = scores[scores["experimentTag"] == tag]
        model = data.experiments[tag]["modelId"]
        abstain_row = {}
        single_row = {}

        for label in labels:
            g = sub[sub["evidence"] == label]
            n = len(g)
            col = f"{label} (N={n})"
            # Abstain rate
            a = g["abstained"].sum()
            abstain_row[col] = f"{a / n * 100:.0f}%" if n else "—"
            # Singleton rate (of non-abstained)
            non_abs = g[~g["abstained"]]
            nn = len(non_abs)
            s = non_abs["decodedScores"].apply(len).eq(1).sum() if nn else 0
            single_row[col] = f"{s / nn * 100:.0f}%" if nn else "—"

        # Total column
        n_total = len(sub)
        a_total = sub["abstained"].sum()
        non_abs_total = sub[~sub["abstained"]]
        nn_total = len(non_abs_total)
        s_total = (
            non_abs_total["decodedScores"].apply(len).eq(1).sum() if nn_total else 0
        )

        abstain_row[f"Total (N={n_total})"] = f"{a_total / n_total * 100:.0f}%"
        single_row[f"Total (N={n_total})"] = (
            f"{s_total / nn_total * 100:.0f}%" if nn_total else "—"
        )

        records.append((model, "Abstain %", abstain_row))
        records.append((model, "Singleton %", single_row))

    idx = pd.MultiIndex.from_tuples([(r[0], r[1]) for r in records])
    return pd.DataFrame([r[2] for r in records], index=idx)


rates_table(scores)

# %% [markdown]
# ### Agreement quality heatmap
#
# Mean expertAgreementProb per (evidence, model). This isolates rubric agreement quality
# from verdict frequency and makes the confidence landscape readable.

# %%
# --- Figure 03: Agreement quality (evidence × model) ---
agreement_df = (
    scores.groupby(["experimentTag", "evidence"], as_index=False)["expertAgreementProb"]
    .mean()
    .rename(columns={"experimentTag": "tag", "expertAgreementProb": "mean_agreement"})
)
agreement_df["model"] = agreement_df["tag"].map(
    {tag: data.experiments[tag]["modelId"] for tag in data.tags}
)

model_order = [data.experiments[tag]["modelId"] for tag in data.tags]
evidence_order = sorted(
    scores["evidence"].dropna().unique(),
    key=lambda e: int(re.search(r"\d+", e).group()),
)

agreement_mat = agreement_df.pivot(index="evidence", columns="model", values="mean_agreement")
agreement_mat = agreement_mat.reindex(index=evidence_order, columns=model_order)

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(
    agreement_mat,
    ax=ax,
    cmap="YlGnBu",
    vmin=0,
    vmax=1,
    annot=True,
    fmt=".2f",
    annot_kws={"fontsize": 10, "fontweight": "bold"},
    linewidths=1.2,
    linecolor="white",
    cbar_kws={"label": "Mean expertAgreementProb"},
)
ax.set_title("Agreement Quality by Evidence and Model", fontsize=14, fontweight="bold")
ax.set_ylabel("Evidence")
ax.set_xlabel("")
ax.tick_params(axis="x", rotation=25)
plt.tight_layout()
savefig("03_agreement_quality")

# %% [markdown]
# ## Belief Function Analysis (Transferable Belief Model)
#
# We model each LLM response as a **mass function** in the Dempster-Shafer / Smets TBM framework,
# using an **open-world assumption** where mass on the empty set represents contradiction.
#
# **Frame of discernment:** `Theta = {1, 2, ..., scale_size}` (the ordinal rubric stages).
#
# **Mass assignment rules** (let `p = expertAgreementProb`):
#
# | Response type | m(verdict) | m(Theta) | m({}) |
# |---|---|---|---|
# | **Normal verdict** (proper subset, e.g. `{2,3}`) | p | 1 - p | 0 |
# | **Full frame** (model chose all stages) | -- | p | 1 - p |
# | **Abstain** (model refused) | -- | 1 - p | p |
#
# - **Normal verdict**: standard simple support function. The probe partitions between the specific verdict and ignorance.
# - **Full frame**: a confident "could be anything" is genuine ignorance; an unconfident one is treated as contradiction.
# - **Abstain**: a confident refusal is genuine contradiction; an unconfident one is closer to ignorance.
#
# Full-frame and abstain are **symmetric mirrors** on the ignorance-contradiction axis, with the probe as the pivot.
#
# We compute mass functions **per rubric** (each rubric is a stochastic draw from the design space),
# then extract pignistic probabilities to see what each rubric "thinks" about each evidence article.

# %%
# --- Build per-rubric TBM mass functions ---

theta = frozenset(range(1, data.scale_size + 1))  # e.g. frozenset({1, 2, 3, 4})


def response_to_mass(row: pd.Series, theta: frozenset) -> MassFunction:
    """
    Convert a single model response to a Dempster-Shafer mass function (TBM).

    Rules (let p = expertAgreementProb):
      - Normal verdict (proper subset of Theta): m(verdict) = p, m(Theta) = 1-p
      - Full frame (verdict == Theta):           m(Theta) = p, m({}) = 1-p
      - Abstain:                                 m({}) = p,    m(Theta) = 1-p
    """
    p = float(row.get("expertAgreementProb") or 1.0)

    if row["abstained"]:
        # Abstain: probe -> contradiction, remainder -> ignorance
        m = MassFunction()
        m[frozenset()] = p  # contradiction
        m[theta] = 1.0 - p  # ignorance
        return m

    verdict = frozenset(int(s) for s in row["decodedScores"])

    if verdict == theta:
        # Full frame: probe -> ignorance, remainder -> contradiction
        m = MassFunction()
        m[theta] = p  # genuine ignorance
        m[frozenset()] = 1.0 - p  # contradiction
        return m

    # Normal verdict: simple support function
    m = MassFunction()
    m[verdict] = p  # specific verdict
    m[theta] = 1.0 - p  # ignorance
    return m


# Build per-rubric mass functions and extract pignistic probabilities
stages = sorted(theta)  # [1, 2, 3, 4]

per_rubric_rows = []
for _, row in scores.iterrows():
    tag = row["experimentTag"]
    model = data.experiments[tag]["modelId"]
    ev_label = row["evidence"]
    rubric_id = row["rubricId"]

    # Build the individual mass function
    m = response_to_mass(row, theta)

    # Pignistic transformation
    pign = m.pignistic()

    rec = {
        "model": model,
        "tag": tag,
        "evidence": ev_label,
        "rubricId": rubric_id,
        "p_score": row.get("expertAgreementProb", np.nan),
        "abstained": row["abstained"],
        "verdict": "ABSTAIN" if row["abstained"] else str(sorted(row["decodedScores"])),
        "conflict": m[frozenset()],
    }
    for s in stages:
        singleton = frozenset({s})
        rec[f"betP_{s}"] = pign[singleton] if singleton in pign else 0.0

    # Max pignistic probability (conviction measure)
    rec["max_betP"] = max([rec[f"betP_{s}"] for s in stages])
    rec["modal_stage"] = max(stages, key=lambda s: rec[f"betP_{s}"])

    per_rubric_rows.append(rec)

    per_rubric_rows.append(rec)

per_rubric_df = pd.DataFrame(per_rubric_rows)

print(f"Built {len(per_rubric_df)} per-rubric mass functions")
print(f"Frame: Theta = {set(theta)}")


# --- Combine mass functions per rubric (aggregate across all evidence) ---

combined_results = []

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = scores[scores["experimentTag"] == tag]

    # Get all unique rubrics for this experiment
    for rubric_id in sub["rubricId"].unique():
        rubric_sub = sub[sub["rubricId"] == rubric_id]
        if rubric_sub.empty:
            continue

        # Build mass functions for all evidence scored by this rubric
        masses = [response_to_mass(row, theta) for _, row in rubric_sub.iterrows()]

        # Combine via unnormalized conjunctive rule (Smets' TBM)
        combined = reduce(
            lambda a, b: a.combine_conjunctive(b, normalization=False),
            masses,
        )

        # Extract DST metrics
        conflict = combined[frozenset()]

        # Handle edge case: if conflict = 1.0, pignistic is undefined
        if conflict >= 0.9999:
            pign = {}  # No belief to distribute
        else:
            pign = combined.pignistic()

        result = {
            "model": model,
            "tag": tag,
            "rubricId": rubric_id,
            "n_evidence": len(rubric_sub),
            "conflict": conflict,
        }

        for s in stages:
            singleton = frozenset({s})
            result[f"bel_{s}"] = combined.bel(singleton)
            result[f"pl_{s}"] = combined.pl(singleton)
            result[f"betP_{s}"] = pign[singleton] if singleton in pign else 0.0

        # Max pignistic (conviction)
        result["max_betP"] = max([result[f"betP_{s}"] for s in stages])
        result["modal_stage"] = max(stages, key=lambda s: result[f"betP_{s}"])

        combined_results.append(result)

combined_df = pd.DataFrame(combined_results)

print(f"\nBuilt {len(combined_df)} combined mass functions (per model × rubric)")

# Filter by conflict threshold
CONFLICT_THRESHOLD = 0.9

print(f"\n=== Conflict filtering (threshold = {CONFLICT_THRESHOLD}) ===")
for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = combined_df[combined_df["tag"] == tag].copy()
    n_total = len(sub)
    n_usable = (sub["conflict"] < CONFLICT_THRESHOLD).sum()
    n_unusable = n_total - n_usable
    pct_unusable = (n_unusable / n_total * 100) if n_total > 0 else 0
    print(
        f"{model}: {n_unusable}/{n_total} unusable ({pct_unusable:.1f}% with conflict ≥ {CONFLICT_THRESHOLD})"
    )

# Display top 10 most convictional rubrics per experiment (filtered)
print(
    f"\n=== Top 10 most convictional rubrics per experiment (conflict < {CONFLICT_THRESHOLD}) ==="
)

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = combined_df[combined_df["tag"] == tag].copy()

    # Filter by conflict threshold
    sub_filtered = sub[sub["conflict"] < CONFLICT_THRESHOLD].copy()

    if sub_filtered.empty:
        print(f"\n--- {model} ---")
        print(f"No rubrics with conflict < {CONFLICT_THRESHOLD}")
        continue

    top10 = sub_filtered.nlargest(10, "max_betP")

    print(f"\n--- {model} ({len(sub_filtered)} usable, showing top {len(top10)}) ---")

    # Build display table with [Bel,Pl] intervals
    disp_rows = []
    for _, r in top10.iterrows():
        row_data = {
            "rubricId": r["rubricId"],
            "conflict": r["conflict"],
        }
        for s in stages:
            row_data[f"[Bel,Pl]({s})"] = f"[{r[f'bel_{s}']:.3f}, {r[f'pl_{s}']:.3f}]"
            row_data[f"BetP({s})"] = r[f"betP_{s}"]
        disp_rows.append(row_data)

    disp_df = pd.DataFrame(disp_rows)

    # Apply styling: bold the winning BetP per row
    def highlight_max_betP(row):
        betP_cols = [f"BetP({s})" for s in stages]
        betP_vals = [row[col] for col in betP_cols]
        max_val = max(betP_vals)
        return [
            "font-weight: bold" if col in betP_cols and row[col] == max_val else ""
            for col in row.index
        ]

    display(
        disp_df.style.format(
            {
                "conflict": "{:.3f}",
                **{f"BetP({s})": "{:.3f}" for s in stages},
            }
        )
        .apply(highlight_max_betP, axis=1)
        .hide(axis="index")
    )

# %% [markdown]
# ## Closed-World DST Analysis
#
# Alternative analysis using **classical Dempster-Shafer** (closed-world assumption):
#
# **Key differences from TBM:**
# - **Drop abstentions** entirely (no mass on empty set)
# - **Full-frame responses** treated as pure ignorance: `m(Theta) = 1.0`
# - **Normalized combination** (Dempster's rule with conflict redistribution)
#
# **Mass assignment rules** (let `p = expertAgreementProb`):
#
# | Response type | m(verdict) | m(Theta) |
# |---|---|---|
# | **Normal verdict** (proper subset) | p | 1 - p |
# | **Full frame** (all stages) | -- | 1.0 |
# | **Abstain** | *dropped* | *dropped* |
#
# This gives us a "best-case" view: what do the rubrics say when we only consider their substantive judgments?

# %%
# --- Closed-World DST: Build per-rubric mass functions ---


def response_to_mass_closed(row: pd.Series, theta: frozenset) -> MassFunction | None:
    """
    Convert a single model response to a classical DST mass function (closed-world).

    Rules (let p = expertAgreementProb):
      - Normal verdict (proper subset): m(verdict) = p, m(Theta) = 1-p
      - Full frame (verdict == Theta):  m(Theta) = 1.0 (pure ignorance)
      - Abstain:                        None (dropped)
    """
    # Drop abstentions
    if row["abstained"]:
        return None

    p = float(row.get("expertAgreementProb") or 1.0)
    verdict = frozenset(int(s) for s in row["decodedScores"])

    # Full frame: pure ignorance
    if verdict == theta:
        m = MassFunction()
        m[theta] = 1.0
        return m

    # Normal verdict: simple support function
    m = MassFunction()
    m[verdict] = p
    m[theta] = 1.0 - p
    return m


# Build per-rubric mass functions (closed-world)
per_rubric_closed_rows = []

for _, row in scores.iterrows():
    m = response_to_mass_closed(row, theta)

    # Skip abstentions
    if m is None:
        continue

    tag = row["experimentTag"]
    model = data.experiments[tag]["modelId"]
    ev_label = row["evidence"]
    rubric_id = row["rubricId"]

    # Pignistic transformation
    pign = m.pignistic()

    rec = {
        "model": model,
        "tag": tag,
        "evidence": ev_label,
        "rubricId": rubric_id,
        "p_score": row.get("expertAgreementProb", np.nan),
        "verdict": str(sorted(row["decodedScores"])),
    }

    for s in stages:
        singleton = frozenset({s})
        rec[f"betP_{s}"] = pign[singleton] if singleton in pign else 0.0

    rec["max_betP"] = max([rec[f"betP_{s}"] for s in stages])
    rec["modal_stage"] = max(stages, key=lambda s: rec[f"betP_{s}"])

    per_rubric_closed_rows.append(rec)

per_rubric_closed_df = pd.DataFrame(per_rubric_closed_rows)

print(f"Built {len(per_rubric_closed_df)} per-rubric mass functions (closed-world)")
print(f"Dropped {len(scores) - len(per_rubric_closed_df)} abstentions")
print(f"Frame: Theta = {set(theta)}")

# %%
# --- Closed-World DST: Combine per rubric with normalized rule ---

combined_closed_results = []

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = scores[scores["experimentTag"] == tag]

    for rubric_id in sub["rubricId"].unique():
        rubric_sub = sub[sub["rubricId"] == rubric_id]
        if rubric_sub.empty:
            continue

        # Build mass functions, filtering out abstentions
        masses = []
        for _, row in rubric_sub.iterrows():
            m = response_to_mass_closed(row, theta)
            if m is not None:
                masses.append(m)

        # Skip if no valid responses
        if not masses:
            continue

        # First combine unnormalized to get conflict
        combined_unnorm = reduce(
            lambda a, b: a.combine_conjunctive(b, normalization=False),
            masses,
        )
        conflict = combined_unnorm[frozenset()]

        # Then combine normalized (classic Dempster)
        combined = reduce(
            lambda a, b: a.combine_conjunctive(b, normalization=True),
            masses,
        )

        # Extract DST metrics
        pign = combined.pignistic()

        result = {
            "model": model,
            "tag": tag,
            "rubricId": rubric_id,
            "n_evidence": len(masses),  # count non-abstentions
            "conflict": conflict,  # conflict that was normalized away
        }

        for s in stages:
            singleton = frozenset({s})
            result[f"bel_{s}"] = combined.bel(singleton)
            result[f"pl_{s}"] = combined.pl(singleton)
            result[f"betP_{s}"] = pign[singleton] if singleton in pign else 0.0

        result["max_betP"] = max([result[f"betP_{s}"] for s in stages])
        result["modal_stage"] = max(stages, key=lambda s: result[f"betP_{s}"])

        combined_closed_results.append(result)

combined_closed_df = pd.DataFrame(combined_closed_results)

print(
    f"\nBuilt {len(combined_closed_df)} combined mass functions (closed-world, per model × rubric)"
)

# Filter by conflict threshold (same as TBM)
CONFLICT_THRESHOLD_CLOSED = 0.9

print(f"\n=== Conflict filtering (threshold = {CONFLICT_THRESHOLD_CLOSED}) ===")
for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = combined_closed_df[combined_closed_df["tag"] == tag].copy()
    n_total = len(sub)
    n_usable = (sub["conflict"] < CONFLICT_THRESHOLD_CLOSED).sum()
    n_unusable = n_total - n_usable
    pct_unusable = (n_unusable / n_total * 100) if n_total > 0 else 0
    print(
        f"{model}: {n_unusable}/{n_total} unusable ({pct_unusable:.1f}% with conflict ≥ {CONFLICT_THRESHOLD_CLOSED})"
    )

# Display top 10 most convictional rubrics per experiment (filtered)
print(
    f"\n=== Top 10 most convictional rubrics per experiment (closed-world, conflict < {CONFLICT_THRESHOLD_CLOSED}) ==="
)

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = combined_closed_df[combined_closed_df["tag"] == tag].copy()

    # Filter by conflict threshold
    sub_filtered = sub[sub["conflict"] < CONFLICT_THRESHOLD_CLOSED].copy()

    if sub_filtered.empty:
        print(f"\n--- {model} ---")
        print(f"No rubrics with conflict < {CONFLICT_THRESHOLD_CLOSED}")
        continue

    top10 = sub_filtered.nlargest(10, "max_betP")

    print(f"\n--- {model} ({len(sub_filtered)} usable, showing top {len(top10)}) ---")

    # Build display table with conflict and BetP values
    disp_rows = []
    for _, r in top10.iterrows():
        row_data = {
            "rubricId": r["rubricId"],
            "n_evidence": int(r["n_evidence"]),
            "conflict": r["conflict"],
        }
        for s in stages:
            row_data[f"BetP({s})"] = r[f"betP_{s}"]
        disp_rows.append(row_data)

    disp_df = pd.DataFrame(disp_rows)

    # Apply styling: bold the winning BetP per row
    def highlight_max_betP(row):
        betP_cols = [f"BetP({s})" for s in stages]
        betP_vals = [row[col] for col in betP_cols]
        max_val = max(betP_vals)
        return [
            "font-weight: bold" if col in betP_cols and row[col] == max_val else ""
            for col in row.index
        ]

    display(
        disp_df.style.format(
            {
                **{f"BetP({s})": "{:.3f}" for s in stages},
            }
        )
        .apply(highlight_max_betP, axis=1)
        .hide(axis="index")
    )

# %%
# --- Final DST aggregation (weighted by rubric critic scores) ---

CONFLICT_THRESHOLD_FINAL = 0.9
stage_cols = [f"betP_{s}" for s in stages]

# One quality weight per (tag, rubric)
rubric_weights = (
    scores.groupby(["experimentTag", "rubricId"], as_index=False)["p_rubric"]
    .mean()
    .rename(columns={"experimentTag": "tag"})
)
rubric_weights["p_rubric"] = rubric_weights["p_rubric"].fillna(0.0).clip(lower=0.0)


def weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    values = np.asarray(values, dtype=float)
    weights = np.asarray(weights, dtype=float)

    mask = np.isfinite(values) & np.isfinite(weights)
    values = values[mask]
    weights = weights[mask]

    if len(values) == 0:
        return np.nan
    if weights.sum() <= 0:
        return float(np.quantile(values, q))

    sorter = np.argsort(values)
    values = values[sorter]
    weights = weights[sorter]

    cdf = np.cumsum(weights)
    cdf = cdf / cdf[-1]
    return float(np.interp(q, cdf, values))


def aggregate_per_evidence(
    per_df: pd.DataFrame,
    combined_conflict_df: pd.DataFrame,
    method_name: str,
) -> pd.DataFrame:
    usable = combined_conflict_df[
        combined_conflict_df["conflict"] < CONFLICT_THRESHOLD_FINAL
    ][["tag", "rubricId"]].drop_duplicates()

    merged = per_df.merge(usable, on=["tag", "rubricId"], how="inner").merge(
        rubric_weights, on=["tag", "rubricId"], how="left"
    )
    merged["p_rubric"] = merged["p_rubric"].fillna(0.0)

    rows = []
    group_cols = ["model", "tag", "evidence"]

    for (model, tag, evidence), g in merged.groupby(group_cols):
        n_rubrics = int(g["rubricId"].nunique())

        for s in stages:
            values = g[f"betP_{s}"].to_numpy(dtype=float)
            weights = g["p_rubric"].to_numpy(dtype=float)

            if np.nansum(weights) <= 0:
                weights = np.ones_like(values, dtype=float)

            rows.append(
                {
                    "method": method_name,
                    "model": model,
                    "tag": tag,
                    "evidence": evidence,
                    "stage": s,
                    "mean_betP": float(np.average(values, weights=weights)),
                    "q10_betP": weighted_quantile(values, weights, 0.10),
                    "q90_betP": weighted_quantile(values, weights, 0.90),
                    "n_rubrics": n_rubrics,
                    "weight_sum": float(np.nansum(weights)),
                }
            )

    out = pd.DataFrame(rows)

    # Keep evidence in E1..E9 order
    out["evidence_num"] = out["evidence"].str.extract(r"E(\d+)").astype(float)
    out = out.sort_values(["model", "evidence_num", "stage"]).drop(
        columns=["evidence_num"]
    )
    return out


agg_tbm = aggregate_per_evidence(per_rubric_df, combined_df, "TBM")
agg_closed = aggregate_per_evidence(
    per_rubric_closed_df, combined_closed_df, "Closed-world"
)
agg_all = pd.concat([agg_tbm, agg_closed], ignore_index=True)

print("Built weighted per-evidence DST aggregates")
print(f"TBM rows: {len(agg_tbm)} | Closed-world rows: {len(agg_closed)}")
print(f"Conflict threshold: {CONFLICT_THRESHOLD_FINAL}")

# Quick sanity check: stage probabilities should sum to ~1 per (method, model, evidence)
check = (
    agg_all.groupby(["method", "model", "evidence"], as_index=False)["mean_betP"]
    .sum()
    .rename(columns={"mean_betP": "sum_mean_betP"})
)

# %%
# --- Figure 05: Closed-world weighted mean BetP heatmaps ---

models = [data.experiments[tag]["modelId"] for tag in data.tags]
n_cols = len(models)

fig, axes = plt.subplots(
    1,
    n_cols,
    figsize=(5 * n_cols, 5),
    sharex=True,
    sharey=True,
    squeeze=False,
)

for j, model in enumerate(models):
    ax = axes[0, j]
    sub = agg_closed[agg_closed["model"] == model].copy()
    pivot = sub.pivot(index="evidence", columns="stage", values="mean_betP")

    evidence_order = sorted(
        pivot.index, key=lambda x: int(re.search(r"E(\d+)", x).group(1))
    )
    pivot = pivot.reindex(index=evidence_order)
    pivot = pivot.reindex(columns=stages)

    show_cbar = j == (n_cols - 1)
    sns.heatmap(
        pivot,
        ax=ax,
        cmap="viridis",
        vmin=0.0,
        vmax=1.0,
        annot=True,
        fmt=".2f",
        cbar=show_cbar,
        cbar_kws={"label": "Weighted mean BetP"} if show_cbar else None,
    )

    ax.set_title(f"{model}", fontsize=12, fontweight="bold")
    ax.set_xlabel("Stage")
    ax.set_ylabel("Evidence")

plt.suptitle(
    "Closed-world DST belief per evidence (weighted, conflict-filtered)",
    y=1.02,
    fontsize=14,
    fontweight="bold",
)
plt.tight_layout()
savefig("05_closedworld_belief_heatmaps")

# %%
# --- Conflict comparison + summary table ---

conflict_plot_df = pd.concat(
    [
        combined_df[["model", "tag", "rubricId", "conflict"]].assign(method="TBM"),
        combined_closed_df[["model", "tag", "rubricId", "conflict"]].assign(
            method="Closed-world"
        ),
    ],
    ignore_index=True,
)

fig, axes = plt.subplots(1, 2, figsize=(12, 4), sharey=True)

for ax, method in zip(axes, ["TBM", "Closed-world"]):
    sub = conflict_plot_df[conflict_plot_df["method"] == method]
    sns.boxplot(data=sub, x="model", y="conflict", ax=ax)
    sns.stripplot(
        data=sub, x="model", y="conflict", ax=ax, color="black", alpha=0.45, size=3
    )
    ax.axhline(CONFLICT_THRESHOLD_FINAL, color="red", linestyle="--", linewidth=1)
    ax.set_title(f"{method} conflict distribution")
    ax.set_xlabel("")
    ax.set_ylabel("Conflict")

plt.tight_layout()
savefig("04_conflict_comparison")


# Summary table (per method x model)
summary_rows = []
for method, df in [("TBM", combined_df), ("Closed-world", combined_closed_df)]:
    for tag in data.tags:
        model = data.experiments[tag]["modelId"]
        sub = df[df["tag"] == tag].copy()

        n_total = len(sub)
        n_usable = int((sub["conflict"] < CONFLICT_THRESHOLD_FINAL).sum())
        usable_pct = (100.0 * n_usable / n_total) if n_total else np.nan

        usable = sub[sub["conflict"] < CONFLICT_THRESHOLD_FINAL]
        mean_conviction = usable["max_betP"].mean() if not usable.empty else np.nan

        summary_rows.append(
            {
                "method": method,
                "model": model,
                "n_total": n_total,
                "n_usable": n_usable,
                "usable_pct": usable_pct,
                "mean_conflict": sub["conflict"].mean() if n_total else np.nan,
                "median_conflict": sub["conflict"].median() if n_total else np.nan,
                "mean_max_betP_usable": mean_conviction,
            }
        )

summary_df = pd.DataFrame(summary_rows).sort_values(["method", "model"])

print(f"Conflict threshold: {CONFLICT_THRESHOLD_FINAL}")
display(
    summary_df.style.format(
        {
            "usable_pct": "{:.1f}%",
            "mean_conflict": "{:.3f}",
            "median_conflict": "{:.3f}",
            "mean_max_betP_usable": "{:.3f}",
        }
    ).hide(axis="index")
)

# %% [markdown]
# ## Verdict Distribution Ridge Plots & Bootstrap Closed-World DST
#
# Two complementary views of verdict behaviour:
#
# 1. **Discrete ridge plots** — For each (model, evidence), show the raw proportion of each verdict
#    category (e.g. `[1]`, `[1,2]`, `[2]`, ..., `ABSTAIN`). No smoothing, no invented metric.
#
# 2. **Bootstrap closed-world DST** — Using classical Dempster's rule (abstentions dropped,
#    conflict normalized out), resample the per-rubric mass functions (n=1000), re-combine
#    each time, and report the 95% CI of pignistic probabilities. This answers:
#    *"How stable is the DST estimate given only ~30 rubrics?"*

# %%
# --- Discrete ridge plot: verdict proportions per (model, evidence) ---
#
# Collapse 15 raw verdict categories into 6 readable bins:
#   Stage 1 only, Stage 2 only, Stage 3 only, Stage 4 only, Multi-stage, ABSTAIN
# This makes the chart instantly readable while preserving the key story:
# "Does the model pick one stage decisively, hedge across stages, or refuse to answer?"

verdict_props = (
    per_rubric_df.groupby(["model", "tag", "evidence", "verdict"])
    .size()
    .reset_index(name="count")
)
verdict_props["total"] = verdict_props.groupby(["model", "tag", "evidence"])[
    "count"
].transform("sum")
verdict_props["proportion"] = verdict_props["count"] / verdict_props["total"]

# Collapse into bins
def _verdict_bin(v: str) -> str:
    if v == "ABSTAIN":
        return "ABSTAIN"
    stages = ast.literal_eval(v)
    if len(stages) == 1:
        return f"Stage {stages[0]}"
    return "Multi-stage"

verdict_props["bin"] = verdict_props["verdict"].apply(_verdict_bin)

# Aggregate proportions within each bin
bin_props = (
    verdict_props.groupby(["model", "tag", "evidence", "bin"])["proportion"]
    .sum()
    .reset_index()
)

# Canonical bin order (stages 1-4, then multi, then abstain)
BIN_ORDER = ["Stage 1", "Stage 2", "Stage 3", "Stage 4", "Multi-stage", "ABSTAIN"]
BIN_COLORS = {
    "Stage 1": "#2ecc71",   # green (safe)
    "Stage 2": "#f39c12",   # amber (moderate)
    "Stage 3": "#e74c3c",   # red (severe)
    "Stage 4": "#8e44ad",   # purple (crisis)
    "Multi-stage": "#3498db",  # blue (hedging)
    "ABSTAIN": "#bdc3c7",   # light gray
}

# Evidence ordering (E1..E9)
evidence_order = sorted(
    per_rubric_df["evidence"].unique(),
    key=lambda e: int(re.search(r"\d+", e).group()),
)
n_evidence = len(evidence_order)
n_models = len(data.tags)

print(f"Verdict bins: {BIN_ORDER}")
print(f"Evidence items: {evidence_order}")
print(f"Models: {bin_props['model'].unique().tolist()}")

# %%
# --- Ridge plot: collapsed bins, one panel per model ---

fig, axes = plt.subplots(
    1,
    n_models,
    figsize=(4.5 * n_models, 1.0 * n_evidence + 1),
    sharey=True,
    sharex=True,
)
if n_models == 1:
    axes = [axes]

bar_width = 0.72

for ax_idx, tag in enumerate(data.tags):
    ax = axes[ax_idx]
    model = data.experiments[tag]["modelId"]
    sub = bin_props[bin_props["tag"] == tag]

    for ev_idx, ev in enumerate(evidence_order):
        ev_sub = sub[sub["evidence"] == ev]
        y_pos = n_evidence - 1 - ev_idx

        left = 0.0
        for b in BIN_ORDER:
            match = ev_sub[ev_sub["bin"] == b]
            p = float(match["proportion"].iloc[0]) if len(match) > 0 else 0.0
            if p > 0:
                ax.barh(
                    y_pos,
                    p,
                    left=left,
                    height=bar_width,
                    color=BIN_COLORS[b],
                    edgecolor="white",
                    linewidth=0.5,
                )
                if p >= 0.10:
                    ax.text(
                        left + p / 2,
                        y_pos,
                        f"{p:.0%}",
                        ha="center",
                        va="center",
                        fontsize=7,
                        fontweight="bold",
                        color="white" if b not in ("ABSTAIN", "Multi-stage") else "black",
                        alpha=0.9,
                    )
                left += p

    ax.set_yticks(range(n_evidence))
    ax.set_yticklabels(list(reversed(evidence_order)), fontsize=10)
    ax.set_xlim(0, 1)
    ax.set_xlabel("Proportion", fontsize=10)
    ax.set_title(f"{model}", fontsize=13, fontweight="bold")
    ax.axvline(0.5, color="gray", linewidth=0.5, alpha=0.2, linestyle="--")

axes[0].set_ylabel("Evidence", fontsize=11)

# Legend — clean, horizontal, below plot
legend_patches = [Patch(facecolor=BIN_COLORS[b], label=b) for b in BIN_ORDER]
fig.legend(
    handles=legend_patches,
    loc="lower center",
    ncol=len(BIN_ORDER),
    fontsize=9,
    frameon=False,
    bbox_to_anchor=(0.5, -0.01),
)

fig.suptitle(
    "Verdict distribution per evidence\n"
    "Single-stage verdicts vs multi-stage hedging vs abstention",
    fontsize=14,
    fontweight="bold",
)

plt.tight_layout(rect=[0, 0.05, 1, 0.94])
savefig("02_ridge_plot")

# %%
# --- Bootstrap DST (closed-world): resample per-rubric mass functions, re-combine, get CI on BetP ---
#
# Uses closed-world DST: abstentions are DROPPED, combination is NORMALIZED (Dempster's rule).
# This avoids the TBM problem where abstentions create contradiction that nukes small samples.
#
# For each (model, evidence), we have ~30 rubric mass functions (minus abstentions).
# Bootstrap: resample with replacement (N_BOOT times),
# re-combine via normalized Dempster's rule, extract pignistic probabilities.

N_BOOT = 1000
RNG = np.random.default_rng(42)

boot_results = []
skipped = []

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    tag_scores = scores[scores["experimentTag"] == tag]

    for ev in evidence_order:
        ev_scores = tag_scores[tag_scores["evidence"] == ev]
        if ev_scores.empty:
            continue

        # Build closed-world mass functions (drops abstentions)
        masses = []
        n_abstained = 0
        for _, row in ev_scores.iterrows():
            m = response_to_mass_closed(row, theta)
            if m is not None:
                masses.append(m)
            else:
                n_abstained += 1

        n_masses = len(masses)
        abstain_rate = (
            n_abstained / (n_masses + n_abstained)
            if (n_masses + n_abstained) > 0
            else 0.0
        )

        if n_masses < 2:
            skipped.append(
                {
                    "model": model,
                    "evidence": ev,
                    "n_active": n_masses,
                    "n_abstained": n_abstained,
                }
            )
            continue

        # Bootstrap: resample and re-combine with normalized rule
        boot_betps = {s: [] for s in stages}
        boot_conflicts = []
        boot_dominant_stages = []  # track which stage wins each iteration

        for _ in range(N_BOOT):
            indices = RNG.integers(0, n_masses, size=n_masses)
            resampled = [masses[i] for i in indices]

            # Unnormalized first (to capture conflict)
            combined_unnorm = reduce(
                lambda a, b: a.combine_conjunctive(b, normalization=False),
                resampled,
            )
            conflict = combined_unnorm[frozenset()]
            boot_conflicts.append(conflict)

            # Normalized combination (classical Dempster's rule)
            combined = reduce(
                lambda a, b: a.combine_conjunctive(b, normalization=True),
                resampled,
            )

            pign = combined.pignistic()
            best_s, best_v = stages[0], 0.0
            for s in stages:
                singleton = frozenset({s})
                val = pign[singleton] if singleton in pign else 0.0
                boot_betps[s].append(val)
                if val > best_v:
                    best_s, best_v = s, val
            boot_dominant_stages.append(best_s)

        # Point estimate (original, no resampling)
        orig_combined = reduce(
            lambda a, b: a.combine_conjunctive(b, normalization=True),
            masses,
        )
        orig_unnorm = reduce(
            lambda a, b: a.combine_conjunctive(b, normalization=False),
            masses,
        )
        orig_conflict = orig_unnorm[frozenset()]
        orig_pign = orig_combined.pignistic()

        # Flip rate: fraction of bootstrap iterations where a different stage wins
        orig_dominant = max(stages, key=lambda s: orig_pign.get(frozenset({s}), 0.0))
        flip_rate = float(np.mean([s != orig_dominant for s in boot_dominant_stages]))

        for s in stages:
            arr = np.array(boot_betps[s])
            singleton = frozenset({s})
            boot_results.append(
                {
                    "model": model,
                    "tag": tag,
                    "evidence": ev,
                    "stage": s,
                    "betP_point": (
                        orig_pign[singleton] if singleton in orig_pign else 0.0
                    ),
                    "betP_mean": float(np.mean(arr)),
                    "betP_q025": float(np.percentile(arr, 2.5)),
                    "betP_q975": float(np.percentile(arr, 97.5)),
                    "betP_std": float(np.std(arr)),
                    "conflict_point": orig_conflict,
                    "conflict_mean": float(np.mean(boot_conflicts)),
                    "n_active": n_masses,
                    "n_abstained": n_abstained,
                    "abstain_rate": abstain_rate,
                    "flip_rate": flip_rate,
                }
            )

boot_df = pd.DataFrame(boot_results)

print(f"Bootstrap closed-world DST: {N_BOOT} iterations")
print(f"Usable (model, evidence) cells: {len(boot_df) // len(stages)}")
print(f"Total rows: {len(boot_df)}")
if skipped:
    print(
        f"\nSkipped {len(skipped)} cells (< 2 active rubrics after dropping abstentions):"
    )
    for s in skipped:
        print(
            f"  {s['model']} / {s['evidence']}: {s['n_active']} active, {s['n_abstained']} abstained"
        )
print(boot_df.head(8).to_string())

# %%
# --- Bootstrap closed-world DST visualization ---
#
# Two standard heatmaps (rows=evidence, cols=models):
#   Figure 6a: Conviction — dominant stage + BetP value
#   Figure 6b: Stability — max 95% CI width (how much it changes under resampling)

STAGE_LABELS = {1: "S1", 2: "S2", 3: "S3", 4: "S4"}

# Build summary: one row per (model, evidence)
model_names = [data.experiments[t]["modelId"] for t in data.tags]
boot_summary = []
for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    for ev in evidence_order:
        ev_sub = boot_df[(boot_df["tag"] == tag) & (boot_df["evidence"] == ev)]
        if ev_sub.empty:
            boot_summary.append({
                "model": model, "evidence": ev,
                "dominant_stage": 0, "max_betP": np.nan,
                "mean_ci_width": np.nan, "flip_rate": np.nan,
                "abstain_rate": 1.0, "status": "dropped",
            })
        else:
            best = ev_sub.loc[ev_sub["betP_point"].idxmax()]
            ci_widths = ev_sub["betP_q975"] - ev_sub["betP_q025"]
            boot_summary.append({
                "model": model, "evidence": ev,
                "dominant_stage": int(best["stage"]),
                "max_betP": float(best["betP_point"]),
                "mean_ci_width": float(ci_widths.mean()),
                "flip_rate": float(ev_sub["flip_rate"].iloc[0]),
                "abstain_rate": float(ev_sub["abstain_rate"].iloc[0]),
                "status": "ok",
            })

boot_summary_df = pd.DataFrame(boot_summary)

# Print summary table
print("\nBootstrap summary per (model, evidence):")
print(boot_summary_df[["model", "evidence", "dominant_stage", "max_betP",
                        "mean_ci_width", "flip_rate", "abstain_rate", "status"]].to_string(index=False))

# Pivot into (evidence × model) matrices
conv_matrix = boot_summary_df.pivot(index="evidence", columns="model", values="max_betP")
conv_matrix = conv_matrix.reindex(index=evidence_order, columns=model_names)

flip_matrix = boot_summary_df.pivot(index="evidence", columns="model", values="flip_rate")
flip_matrix = flip_matrix.reindex(index=evidence_order, columns=model_names)

# Build annotation matrices
conv_annot = pd.DataFrame("", index=evidence_order, columns=model_names)
flip_annot = pd.DataFrame("", index=evidence_order, columns=model_names)

for _, row in boot_summary_df.iterrows():
    ev, mdl = row["evidence"], row["model"]
    if row["status"] == "dropped":
        conv_annot.loc[ev, mdl] = "DROP"
        flip_annot.loc[ev, mdl] = "—"
    else:
        s = STAGE_LABELS[int(row["dominant_stage"])]
        b = row["max_betP"]
        a = row["abstain_rate"]
        conv_annot.loc[ev, mdl] = f"{s} {b:.2f}" + (f"\nabs:{a:.0%}" if a > 0.1 else "")

        fr = row["flip_rate"]
        flip_annot.loc[ev, mdl] = f"{fr:.0%}"

# --- Figure 6a: Conviction heatmap ---
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(
    conv_matrix, ax=ax, cmap="YlOrRd", vmin=0, vmax=1,
    annot=conv_annot, fmt="", annot_kws={"fontsize": 9, "fontweight": "bold"},
    linewidths=1.5, linecolor="white",
    cbar_kws={"label": "BetP (conviction)", "shrink": 0.8},
)
ax.set_title(
    f"Bootstrap DST: Dominant Stage & Conviction\n"
    f"(n_boot={N_BOOT}, closed-world, abstentions dropped)",
    fontsize=13, fontweight="bold", pad=12,
)
ax.set_ylabel("Evidence", fontsize=11)
ax.set_xlabel("")
ax.tick_params(axis="x", rotation=30)
plt.tight_layout()
savefig("06a_bootstrap_conviction")

# --- Figure 6b: Dominant-stage flip rate ---
fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(
    flip_matrix, ax=ax, cmap="RdYlGn_r", vmin=0, vmax=1,
    annot=flip_annot, fmt="", annot_kws={"fontsize": 11, "fontweight": "bold"},
    linewidths=1.5, linecolor="white",
    cbar_kws={"label": "Flip rate (instability)", "shrink": 0.8},
)
ax.set_title(
    f"Bootstrap DST: Dominant Stage Flip Rate\n"
    f"How often does a different stage win under rubric resampling?",
    fontsize=13, fontweight="bold", pad=12,
)
ax.set_ylabel("Evidence", fontsize=11)
ax.set_xlabel("")
ax.tick_params(axis="x", rotation=30)
plt.tight_layout()
savefig("06b_bootstrap_stability")

# %%
# --- Figure 08: Evidence consensus matrix (pairwise dominant-stage agreement) ---
model_pairs = list(combinations(model_names, 2))
pair_labels = [f"{a} vs {b}" for a, b in model_pairs]

consensus_rows = []
for ev in evidence_order:
    row = {}
    for a, b in model_pairs:
        a_row = boot_summary_df[
            (boot_summary_df["model"] == a) & (boot_summary_df["evidence"] == ev)
        ].iloc[0]
        b_row = boot_summary_df[
            (boot_summary_df["model"] == b) & (boot_summary_df["evidence"] == ev)
        ].iloc[0]
        if a_row["status"] != "ok" or b_row["status"] != "ok":
            row[f"{a} vs {b}"] = np.nan
        else:
            row[f"{a} vs {b}"] = float(a_row["dominant_stage"] == b_row["dominant_stage"])
    consensus_rows.append(row)

consensus_mat = pd.DataFrame(consensus_rows, index=evidence_order, columns=pair_labels)
consensus_annot = pd.DataFrame("", index=evidence_order, columns=pair_labels, dtype=object)
for r in consensus_annot.index:
    for c in consensus_annot.columns:
        v = consensus_annot.loc[r, c]
        if pd.isna(v):
            consensus_annot.loc[r, c] = "—"
        else:
            consensus_annot.loc[r, c] = "Agree" if v == 1.0 else "Disagree"

fig, ax = plt.subplots(figsize=(11, 6))
sns.heatmap(
    consensus_mat,
    ax=ax,
    cmap="RdYlGn",
    vmin=0,
    vmax=1,
    annot=consensus_annot,
    fmt="",
    annot_kws={"fontsize": 9, "fontweight": "bold"},
    linewidths=1.2,
    linecolor="white",
    cbar_kws={"label": "Dominant-stage agreement"},
)
ax.set_title(
    "Evidence Consensus Matrix\nPairwise agreement on dominant stage",
    fontsize=13,
    fontweight="bold",
    pad=10,
)
ax.set_ylabel("Evidence")
ax.set_xlabel("Model pairs")
ax.tick_params(axis="x", rotation=30)
plt.tight_layout()
savefig("08_evidence_consensus")

# %%
# --- Bootstrap stability summary per model ---
#
# For each model, report:
# - Mean CI width across all (evidence, stage) cells
# - Max CI width (worst-case instability)
# - Mean conflict under bootstrap
# - Fraction of cells where CI width > 0.1 (materially unstable)

stability_rows = []

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = boot_df[boot_df["tag"] == tag]

    ci_widths = sub["betP_q975"] - sub["betP_q025"]

    stability_rows.append(
        {
            "model": model,
            "n_cells": len(sub),
            "mean_ci_width": float(ci_widths.mean()),
            "median_ci_width": float(ci_widths.median()),
            "max_ci_width": float(ci_widths.max()),
            "frac_unstable": float((ci_widths > 0.1).mean()),
            "mean_betP_std": float(sub["betP_std"].mean()),
            "mean_conflict": float(sub["conflict_mean"].mean()),
        }
    )

stability_df = pd.DataFrame(stability_rows).sort_values("mean_ci_width")

print("\nBootstrap DST Stability Summary")
print(f"(n_boot={N_BOOT}, per-evidence closed-world combination)")
print("=" * 80)
print(stability_df.to_string(index=False))

print("\nMetric definitions:")
print("- mean_ci_width: Avg 95% CI width of BetP across all (evidence, stage) cells")
print("- max_ci_width: Worst-case CI width (most unstable cell)")
print(
    "- frac_unstable: % of cells where CI width > 0.1 (materially sensitive to rubric selection)"
)
print(
    "- mean_conflict: Avg DST conflict under bootstrap (higher = more contradictory evidence)"
)

# %%
# --- Decision-space geometry metrics (from bootstrap closed-world BetP) ---
#
# For each model, pivot the boot_df point estimates into a (n_evidence x n_stages) matrix
# and compute geometry metrics over that matrix.

stage_cols = sorted(boot_df["stage"].unique())
betp_cols_geo = [f"betP_{s}" for s in stage_cols]

geometry_metrics = []

for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    sub = boot_df[boot_df["tag"] == tag]

    # Pivot: rows = evidence, cols = stages, values = point BetP
    wide = sub.pivot_table(
        index="evidence", columns="stage", values="betP_point"
    ).reindex(columns=stage_cols)

    if len(wide) < 2:
        continue

    betp_matrix = wide.values

    # 1. Mean pairwise distance in N-stage pignistic space
    pairwise_dists = pdist(betp_matrix, metric="euclidean")
    mean_dist = float(np.mean(pairwise_dists))
    std_dist = float(np.std(pairwise_dists))

    # 2. Shannon entropy of pignistic distribution per evidence
    entropies = []
    for vec in betp_matrix:
        v = vec + 1e-10
        v = v / v.sum()
        entropies.append(float(-np.sum(v * np.log2(v))))

    mean_entropy = float(np.mean(entropies))
    std_entropy = float(np.std(entropies))

    # 3. Discreteness score: fraction of evidence items with max(betP) > 0.8
    max_betp = betp_matrix.max(axis=1)
    discreteness = float((max_betp > 0.8).mean())

    geometry_metrics.append(
        {
            "model": model,
            "n_evidence": len(wide),
            "mean_pairwise_dist": mean_dist,
            "std_pairwise_dist": std_dist,
            "mean_entropy": mean_entropy,
            "std_entropy": std_entropy,
            "discreteness_score": discreteness,
        }
    )

geometry_df = pd.DataFrame(geometry_metrics).sort_values(
    "discreteness_score", ascending=False
)

print("\nDecision Space Geometry Metrics (from bootstrap closed-world BetP)")
print("=" * 80)
print(geometry_df.to_string(index=False))

print("\nMetric definitions:")
print(
    "- mean_pairwise_dist: Avg euclidean distance between evidence BetP vectors (larger = more diverse)"
)
print(
    "- mean_entropy: Avg Shannon entropy of BetP distributions (higher = more uncertain)"
)
print(
    "- discreteness_score: % of evidence items with max(BetP) > 0.8 (higher = more decisive)"
)

# %%
# --- Figure 07: Model summary profile (grouped bars) ---
#
# One-glance model comparison on normalized [0,1] metrics:
# abstain rate, flip rate, entropy (normalized), discreteness, mean conflict.

max_entropy = np.log2(len(stages)) if len(stages) > 1 else 1.0

profile_rows = []
for tag in data.tags:
    model = data.experiments[tag]["modelId"]
    bsub = boot_df[boot_df["tag"] == tag]
    ssub = boot_summary_df[(boot_summary_df["model"] == model) & (boot_summary_df["status"] == "ok")]
    gsub = geometry_df[geometry_df["model"] == model]

    profile_rows.append(
        {
            "model": model,
            "abstain_rate": float(ssub["abstain_rate"].mean()) if not ssub.empty else np.nan,
            "flip_rate": float(ssub["flip_rate"].mean()) if not ssub.empty else np.nan,
            "entropy_norm": (
                float(gsub["mean_entropy"].iloc[0]) / max_entropy if not gsub.empty else np.nan
            ),
            "discreteness": float(gsub["discreteness_score"].iloc[0]) if not gsub.empty else np.nan,
            "mean_conflict": float(bsub["conflict_mean"].mean()) if not bsub.empty else np.nan,
        }
    )

profile_df = pd.DataFrame(profile_rows)
print("\nModel summary profile metrics:")
print(profile_df.to_string(index=False))

profile_long = profile_df.melt(id_vars=["model"], var_name="metric", value_name="value")
metric_order = ["abstain_rate", "flip_rate", "entropy_norm", "discreteness", "mean_conflict"]
profile_long["metric"] = pd.Categorical(profile_long["metric"], categories=metric_order, ordered=True)

fig, ax = plt.subplots(figsize=(11, 5))
sns.barplot(
    data=profile_long,
    x="metric",
    y="value",
    hue="model",
    ax=ax,
)
ax.set_ylim(0, 1.0)
ax.set_xlabel("")
ax.set_ylabel("Normalized score (0-1)")
ax.set_title("Model Summary Profile", fontsize=14, fontweight="bold")
ax.set_xticks(np.arange(len(metric_order)))
ax.set_xticklabels(
    ["Abstain rate", "Flip rate", "Entropy (norm)", "Discreteness", "Mean conflict"],
    rotation=15,
)
ax.legend(title="Model", bbox_to_anchor=(1.02, 1), loc="upper left")
ax.grid(axis="y", alpha=0.2)
plt.tight_layout()
savefig("07_model_summary_profile")

# %%
# ---------------------------------------------------------------------------
# Finish — close log
# ---------------------------------------------------------------------------
elapsed = time.time() - _start_time
print(f"\n=== Done in {elapsed:.1f}s  |  Log: {LOG_PATH}  ===")
_log_fh.close()
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
