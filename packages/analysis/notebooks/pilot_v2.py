# %% [markdown]
# # Pilot Study v2
#
# Multiple experiments (from `TAGS`) scoring news articles on a 4-point fascism rubric.
#
# Data is pulled via `judge_gym.collect.pull_experiments` (single bulk Convex query per experiment).

# %%
import ast
import re
from functools import reduce
from itertools import combinations

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
import statsmodels.formula.api as smf
from judge_gym.collect import pull_experiments
from matplotlib.colors import Normalize as mplNormalize
from pyds import MassFunction

# %%
TAGS = [
    "ecc-fascism-usa-trial-gpt-4.1",
    "ecc-fascism-usa-trial-gemini-3.0-flash",
    "ecc-fascism-usa-trial-gpt-5.2-chat",
    "ecc-fascism-usa-trial-qwen3-235b",
    "ecc-fascism-usa-trial-gpt-4.1-mini",
]

data = pull_experiments(TAGS)
print(f"Tags pulled: {data.tags}")
print(f"Scale size:  {data.scale_size}")
print(f"Scores:      {len(data.scores)} rows")
print(f"Evidence:    {len(data.evidence)} articles")

# %% [markdown]
# ## Evidence

# %%
scores = data.scores.copy()
eid_to_label = dict(zip(data.evidence["evidenceId"], data.evidence["label"]))
scores["evidence"] = scores["evidenceId"].map(eid_to_label)

data.evidence[["label", "title"]]

# %% [markdown]
# ## Subset-exploded stage counts per evidence
#
# Stacked bar charts showing the distribution of individual stages chosen across all verdicts,
# plus abstain rates. Each verdict is exploded into its component stages (e.g., `[2,3]` → stage 2 + stage 3).

# %%
# --- Subset-exploded stage counts per evidence ---
# Vertical stacked bar charts, one panel per model (2 columns).
# Each verdict is exploded into component stages, plus abstain counts.


def _explode_stages(row):
    """Explode a verdict into individual stage selections."""
    if row["abstained"]:
        return ["ABSTAIN"]
    else:
        return row["decodedScores"]


# Build exploded stage counts per evidence per model
n_models = len(data.tags)
n_cols = 2
n_rows = (n_models + n_cols - 1) // n_cols  # Ceiling division
fig, axes = plt.subplots(n_rows, n_cols, figsize=(10 * n_cols, 6 * n_rows), sharey=True)

# Flatten axes array for easier iteration
if n_models == 1:
    axes = [axes]
else:
    axes = axes.flatten()

# Get all stages + ABSTAIN
all_stages = list(range(1, data.scale_size + 1)) + ["ABSTAIN"]

# Heat scale colors: stage 1 (coolest) to stage 4 (hottest), then grey for ABSTAIN
# Using YlOrRd colormap for heat scale
heat_colors = plt.cm.YlOrRd(np.linspace(0.3, 0.9, data.scale_size))
stage_colors = list(heat_colors) + [(0.7, 0.7, 0.7)]  # Add grey for ABSTAIN

for idx, tag in enumerate(data.tags):
    ax = axes[idx]
    model = data.experiments[tag]["modelId"]
    sub = scores[scores["experimentTag"] == tag].copy()

    # Explode verdicts into individual stages
    sub["stages"] = sub.apply(_explode_stages, axis=1)
    exploded = sub.explode("stages")

    # Count stages per evidence
    ev_labels = sorted(eid_to_label.values(), key=lambda l: int(l[1:]))
    stage_counts = exploded.groupby(["evidence", "stages"]).size().unstack(fill_value=0)

    # Reindex to ensure all stages and evidence are present
    stage_counts = stage_counts.reindex(
        index=ev_labels, columns=all_stages, fill_value=0
    )

    # Create vertical stacked bar chart
    stage_counts.plot(
        kind="bar",
        stacked=True,
        ax=ax,
        color=stage_colors,
        width=0.7,
        legend=(idx == n_models - 1),  # Only show legend on last panel
    )

    ax.set_title(f"{model}", fontsize=13, fontweight="bold")
    ax.set_ylabel("Count")
    ax.set_xlabel("Evidence")
    ax.grid(axis="y", alpha=0.3)
    ax.set_xticklabels(ev_labels, rotation=0)

    # Add count annotations on bars
    for i, evidence in enumerate(ev_labels):
        cumulative = 0
        for stage in all_stages:
            count = stage_counts.loc[evidence, stage]
            if count > 0:
                ax.text(
                    i,
                    cumulative + count / 2,
                    str(int(count)),
                    ha="center",
                    va="center",
                    fontsize=8,
                    fontweight="bold",
                    color="white" if count > 5 else "black",
                )
                cumulative += count

# Hide unused subplots
for idx in range(n_models, len(axes)):
    axes[idx].set_visible(False)

# Adjust legend
if n_models > 0:
    axes[n_models - 1].legend(
        title="Stage",
        bbox_to_anchor=(1.05, 1),
        loc="upper left",
        frameon=True,
    )

fig.suptitle(
    "Subset-exploded stage counts per evidence",
    fontsize=14,
    fontweight="bold",
    y=0.98,
)
plt.tight_layout()
plt.show()

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
# ### Verdict distribution heatmaps with proportions and average expert probe
#
# Each cell displays **(proportion, avg expertAgreementProb)** for that evidence-verdict combination,
# both formatted with 2 decimal places. All responses — **including abstains** — are included.
# Each row (evidence) is normalized to sum to 1.
#
# One panel per model, stacked vertically. Columns are powerset verdicts sorted by
# center-of-gravity, then cardinality. Empty cells (0.00) are left blank.

# %%
# --- Verdict distribution heatmaps with proportions and average expert probe ---
# Two panels per row (2 columns). Evidence on y-axis, powerset verdicts on x-axis.
# Each cell shows (proportion [0,1], avg_expertAgreementProb) with 2 sig figs.
# Rows are normalized to sum to 1. A thin visual separator is drawn before ABSTAIN.


def _col_sort_key(col: str):
    """Sort verdict columns: by center-of-gravity, then cardinality, then elements.
    ABSTAIN always sorts last."""
    if col == "ABSTAIN":
        return (999, 0, [])
    stages = ast.literal_eval(col)  # e.g. "[2, 3]" -> [2, 3]
    cog = sum(stages) / len(stages)
    return (cog, len(stages), stages)


# Collect all verdicts across all models
tmp_all = scores.copy()
tmp_all["verdict"] = tmp_all.apply(
    lambda r: "ABSTAIN" if r["abstained"] else str(sorted(r["decodedScores"])),
    axis=1,
)
all_verdicts = sorted(tmp_all["verdict"].unique(), key=_col_sort_key)


def _build_count_and_avg_matrices(
    sub: pd.DataFrame, all_verdicts: list
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Build evidence × verdict count matrix and average expertAgreementProb matrix."""
    ev_labels = sorted(eid_to_label.values(), key=lambda l: int(l[1:]))
    tmp = sub.copy()
    tmp["verdict"] = tmp.apply(
        lambda r: "ABSTAIN" if r["abstained"] else str(sorted(r["decodedScores"])),
        axis=1,
    )
    tmp["expertAgreementProb"] = tmp["expertAgreementProb"].fillna(1.0)

    # Count matrix
    count_pivot = (
        tmp.groupby(["evidence", "verdict"])
        .size()
        .unstack(fill_value=0)
        .reindex(index=ev_labels, columns=all_verdicts, fill_value=0)
    )

    # Average expertAgreementProb matrix
    avg_pivot = (
        tmp.groupby(["evidence", "verdict"])["expertAgreementProb"]
        .mean()
        .unstack(fill_value=0)
        .reindex(index=ev_labels, columns=all_verdicts, fill_value=0)
    )

    return count_pivot, avg_pivot


def _insert_thin_separator(df: pd.DataFrame) -> pd.DataFrame:
    """Insert a narrow NaN spacer column before ABSTAIN for a small visual gap."""
    if "ABSTAIN" not in df.columns:
        return df
    cols = [c for c in df.columns if c != "ABSTAIN"]
    sep = pd.DataFrame(np.nan, index=df.index, columns=[" "])
    return pd.concat([df[cols], sep, df[["ABSTAIN"]]], axis=1)


n_models = len(data.tags)
n_rows = (n_models + 1) // 2  # 2 charts per row
fig, axes = plt.subplots(n_rows, 2, figsize=(34, 6 * n_rows))
if n_models == 1:
    axes = np.array([[axes]])
elif n_rows == 1:
    axes = axes.reshape(1, -1)

# Flatten axes for easier iteration
axes_flat = axes.flatten()

for idx, tag in enumerate(data.tags):
    ax = axes_flat[idx]
    model = data.experiments[tag]["modelId"]
    sub = scores[scores["experimentTag"] == tag]

    count_mat, avg_mat = _build_count_and_avg_matrices(sub, all_verdicts)

    # Convert counts to proportions (row-normalized to [0, 1])
    prop_mat = count_mat.div(count_mat.sum(axis=1), axis=0)

    # Insert thin spacer before ABSTAIN
    prop_mat = _insert_thin_separator(prop_mat)
    avg_mat = _insert_thin_separator(avg_mat)

    mask = prop_mat.isna()
    plot_data = prop_mat.fillna(0)

    # Use proportion for heatmap color intensity
    sns.heatmap(
        plot_data,
        annot=False,
        mask=mask,
        cmap="YlOrRd",
        vmin=0,
        vmax=1,
        linewidths=0.5,
        cbar=True,
        cbar_kws={"label": "Proportion"},
        ax=ax,
    )

    # Annotations: (proportion, avg_prob) with 2 sig figs
    for row_i in range(plot_data.shape[0]):
        for col_j in range(plot_data.shape[1]):
            prop = prop_mat.iloc[row_i, col_j]
            avg_prob = avg_mat.iloc[row_i, col_j]
            if pd.isna(prop) or prop == 0:
                continue

            # Format text with 2 sig figs
            text = f"({prop:.2f}, {avg_prob:.2f})"

            # Alpha based on proportion
            norm = mplNormalize(vmin=0, vmax=1)
            alpha = max(0.3, norm(prop))

            ax.text(
                col_j + 0.5,
                row_i + 0.5,
                text,
                ha="center",
                va="center",
                fontsize=8,
                fontweight="bold",
                color=(0, 0, 0, alpha),
            )

    # Thin white stripe over the spacer column
    spacer_idx = None
    for ci, c in enumerate(prop_mat.columns):
        if c == " ":
            spacer_idx = ci
            break
    if spacer_idx is not None:
        ax.axvline(x=spacer_idx, color="white", linewidth=3, zorder=5)
        ax.axvline(x=spacer_idx + 1, color="white", linewidth=3, zorder=5)

    ax.set_title(f"{model}", fontsize=13, fontweight="bold")
    ax.set_ylabel("Evidence")
    ax.set_xlabel("Verdict")
    ax.tick_params(axis="x", rotation=45)

# Hide any unused subplots
for idx in range(n_models, len(axes_flat)):
    axes_flat[idx].set_visible(False)

fig.suptitle(
    "Verdict distribution per evidence: (proportion, avg expertAgreementProb)",
    fontsize=14,
    fontweight="bold",
    y=0.995,
)
plt.tight_layout()
plt.show()

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
# --- Final visualization: weighted mean BetP heatmaps ---

methods = ["TBM", "Closed-world"]
models = [data.experiments[tag]["modelId"] for tag in data.tags]

n_rows = len(methods)
n_cols = len(models)
fig, axes = plt.subplots(
    n_rows,
    n_cols,
    figsize=(6 * n_cols, 4.8 * n_rows),
    sharex=True,
    sharey=True,
    squeeze=False,
)

for i, method in enumerate(methods):
    for j, model in enumerate(models):
        ax = axes[i, j]

        sub = agg_all[
            (agg_all["method"] == method) & (agg_all["model"] == model)
        ].copy()
        pivot = sub.pivot(index="evidence", columns="stage", values="mean_betP")

        # Ensure consistent axis order
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

        ax.set_title(f"{method} | {model}")
        ax.set_xlabel("Stage")
        ax.set_ylabel("Evidence")

plt.suptitle(
    "Final stage belief per evidence (weighted by rubric critic score, conflict-filtered)",
    y=1.01,
)
plt.tight_layout()
plt.show()

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
plt.show()


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
# ## Pairwise Divergence Analysis
#
# We compare final per-evidence stage distributions between model pairs using:
#
# - **Jensen-Shannon divergence (JSD)** as the primary symmetric metric
# - **Kullback-Leibler divergence (KL)** in both directions to capture asymmetry
# - **Total variation (TV)** distance as an interpretable mass-shift measure
#
# This is computed for both **TBM** and **Closed-world** aggregated BetP distributions.

# %%
# --- Compute pairwise divergence metrics (JSD, KL, TV) ---


def normalize_with_eps(p: np.ndarray, eps: float = 1e-8) -> np.ndarray:
    p = np.asarray(p, dtype=float)
    p = np.where(np.isfinite(p), p, 0.0)
    p = np.clip(p, eps, None)
    return p / p.sum()


def kl_div(p: np.ndarray, q: np.ndarray, eps: float = 1e-8) -> float:
    p = normalize_with_eps(p, eps)
    q = normalize_with_eps(q, eps)
    return float(np.sum(p * np.log(p / q)))


def js_div(p: np.ndarray, q: np.ndarray, eps: float = 1e-8) -> float:
    p = normalize_with_eps(p, eps)
    q = normalize_with_eps(q, eps)
    m = 0.5 * (p + q)
    return 0.5 * kl_div(p, m, eps) + 0.5 * kl_div(q, m, eps)


def tv_dist(p: np.ndarray, q: np.ndarray, eps: float = 1e-8) -> float:
    p = normalize_with_eps(p, eps)
    q = normalize_with_eps(q, eps)
    return float(0.5 * np.sum(np.abs(p - q)))


# Build wide table: one row per (method, model, evidence), columns betP_1..betP_4
agg_wide = agg_all.pivot_table(
    index=["method", "model", "evidence"],
    columns="stage",
    values="mean_betP",
    aggfunc="first",
).reset_index()

agg_wide.columns = [
    c if isinstance(c, str) else f"betP_{int(c)}" for c in agg_wide.columns
]

stage_prob_cols = [f"betP_{s}" for s in stages]
model_order = [data.experiments[tag]["modelId"] for tag in data.tags]
model_pairs = list(combinations(model_order, 2))

rows = []
for method in agg_wide["method"].unique():
    method_df = agg_wide[agg_wide["method"] == method]
    evidences = sorted(
        method_df["evidence"].unique(),
        key=lambda x: int(re.search(r"E(\d+)", x).group(1)),
    )

    for evidence in evidences:
        e_df = method_df[method_df["evidence"] == evidence]

        for model_a, model_b in model_pairs:
            a_row = e_df[e_df["model"] == model_a]
            b_row = e_df[e_df["model"] == model_b]
            if a_row.empty or b_row.empty:
                continue

            p = a_row.iloc[0][stage_prob_cols].to_numpy(dtype=float)
            q = b_row.iloc[0][stage_prob_cols].to_numpy(dtype=float)

            delta = normalize_with_eps(p) - normalize_with_eps(q)
            pair_label = f"{model_a} vs {model_b}"

            row = {
                "method": method,
                "evidence": evidence,
                "model_a": model_a,
                "model_b": model_b,
                "pair": pair_label,
                "JSD": js_div(p, q),
                "KL_a_to_b": kl_div(p, q),
                "KL_b_to_a": kl_div(q, p),
                "TV": tv_dist(p, q),
            }

            for s, d in zip(stages, delta):
                row[f"delta_betP_{s}"] = float(d)

            rows.append(row)

divergence_df = pd.DataFrame(rows)

print(f"Computed divergence rows: {len(divergence_df)}")
print(f"Model pairs: {len(model_pairs)} | Methods: {divergence_df['method'].nunique()}")

# Summary by pair/method
pair_summary = (
    divergence_df.groupby(["method", "pair"], as_index=False)
    .agg(
        mean_JSD=("JSD", "mean"),
        median_JSD=("JSD", "median"),
        mean_TV=("TV", "mean"),
        mean_KL_a_to_b=("KL_a_to_b", "mean"),
        mean_KL_b_to_a=("KL_b_to_a", "mean"),
        n_evidence=("evidence", "nunique"),
    )
    .sort_values(["method", "mean_JSD"], ascending=[True, False])
)

display(
    pair_summary.style.format(
        {
            "mean_JSD": "{:.4f}",
            "median_JSD": "{:.4f}",
            "mean_TV": "{:.4f}",
            "mean_KL_a_to_b": "{:.4f}",
            "mean_KL_b_to_a": "{:.4f}",
        }
    ).hide(axis="index")
)

# Top divergent evidence per pair/method
top_divergent = (
    divergence_df.sort_values(["method", "pair", "JSD"], ascending=[True, True, False])
    .groupby(["method", "pair"], as_index=False)
    .head(3)
)

print("Top-3 evidence items by JSD (per method x pair):")
display(
    top_divergent[["method", "pair", "evidence", "JSD", "TV", "KL_a_to_b", "KL_b_to_a"]]
    .style.format(
        {
            "JSD": "{:.4f}",
            "TV": "{:.4f}",
            "KL_a_to_b": "{:.4f}",
            "KL_b_to_a": "{:.4f}",
        }
    )
    .hide(axis="index")
)

# %%
