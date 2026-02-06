"""
OLS regression models for the analysis plan.
"""

import pandas as pd
import statsmodels.formula.api as smf
from statsmodels.regression.linear_model import RegressionResultsWrapper


def score_regression(df: pd.DataFrame) -> RegressionResultsWrapper:
    """
    Score ~ Model + RubricQuality + Concept
    For ECC tasks: tests whether model family predicts score after
    controlling for rubric quality.
    """
    return smf.ols(
        "score ~ C(modelId) + rubricQuality + C(concept)",
        data=df,
    ).fit()


def ablation_regression(df: pd.DataFrame) -> RegressionResultsWrapper:
    """
    Score ~ Model + ScoringMethod + ScaleSize + Neutralization
    Pooled across task types for ablation analysis.
    """
    return smf.ols(
        "score ~ C(modelId) + C(scoringMethod) + scaleSize + C(neutralizeEvidence)",
        data=df,
    ).fit()


def uncertainty_regression(df: pd.DataFrame) -> RegressionResultsWrapper:
    """
    UncertaintyGap ~ Model + Concept + RubricQuality
    For subset scoring only — tests what drives epistemic uncertainty.
    """
    return smf.ols(
        "uncertaintyGap ~ C(modelId) + C(concept) + rubricQuality",
        data=df,
    ).fit()
