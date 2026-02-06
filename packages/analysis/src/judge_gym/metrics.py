"""
Core metrics: JSD polarization, entrenchment index, swap sensitivity.
"""

import numpy as np
from scipy.spatial.distance import jensenshannon


def jsd_polarization(dist_a: np.ndarray, dist_b: np.ndarray) -> float:
    """
    Jensen-Shannon Divergence between two score distributions.
    Returns a value in [0, 1] (using base-2 log).
    """
    # Normalize to probability distributions
    p = dist_a / dist_a.sum() if dist_a.sum() > 0 else dist_a
    q = dist_b / dist_b.sum() if dist_b.sum() > 0 else dist_b
    return float(jensenshannon(p, q, base=2) ** 2)


def entrenchment_index(polarization: float, mean_expert_prob: float) -> float:
    """
    Entrenchment = Polarization × Mean(Expert Agreement Prob).
    High E = models disagree AND think everyone agrees with them.
    """
    return polarization * mean_expert_prob


def swap_sensitivity(original_probs: np.ndarray, swapped_probs: np.ndarray) -> float:
    """
    Mean absolute change in expert agreement probability under rubric swap.
    """
    return float(np.mean(np.abs(original_probs - swapped_probs)))


def score_histogram(decoded_scores: list[list[int]], scale_size: int = 4) -> np.ndarray:
    """
    Build a score histogram from decoded scores.
    For single verdicts, each sample contributes 1 to its score bin.
    For subset verdicts, each sample contributes 1/|subset| to each selected bin.
    """
    hist = np.zeros(scale_size)
    for scores in decoded_scores:
        weight = 1.0 / len(scores)
        for s in scores:
            if 1 <= s <= scale_size:
                hist[s - 1] += weight
    return hist
