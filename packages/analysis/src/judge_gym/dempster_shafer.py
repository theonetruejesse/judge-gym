"""
Dempster-Shafer Theory aggregation for subset verdicts.

Frame of discernment: Θ = {s_1, s_2, ..., s_n} (n-point scale).
Each sample verdict → basic mass assignment m(A) = 1 where A ⊆ Θ.
"""

from itertools import combinations

import numpy as np

Frame = frozenset


def mass_from_verdict(
    decoded_scores: list[int], scale_size: int = 4
) -> dict[frozenset, float]:
    """Convert a single sample verdict into a basic mass assignment."""
    focal = frozenset(decoded_scores)
    return {focal: 1.0}


def combine(
    m1: dict[frozenset, float], m2: dict[frozenset, float]
) -> tuple[dict[frozenset, float], float]:
    """Dempster's rule of combination. Returns (combined_mass, conflict_k)."""
    combined: dict[frozenset, float] = {}
    k = 0.0
    for a, ma in m1.items():
        for b, mb in m2.items():
            intersection = a & b
            if not intersection:
                k += ma * mb
            else:
                combined[intersection] = combined.get(intersection, 0) + ma * mb
    norm = 1 - k
    if norm == 0:
        return {}, 1.0
    return {a: v / norm for a, v in combined.items()}, k


def aggregate_samples(
    samples: list[dict],
) -> tuple[dict[frozenset, float], float]:
    """Combine all sample masses for a (model, evidence) pair."""
    masses = [
        mass_from_verdict(s["decodedScores"])
        for s in samples
        if not s["abstained"] and s["decodedScores"]
    ]
    if len(masses) < 2:
        return masses[0] if masses else {}, 0.0
    result = masses[0]
    total_k = 0.0
    for m in masses[1:]:
        result, k = combine(result, m)
        total_k = max(total_k, k)
    return result, total_k


def belief(mass: dict[frozenset, float], hypothesis: frozenset) -> float:
    """Belief: sum of mass for all subsets of the hypothesis."""
    return sum(v for a, v in mass.items() if a <= hypothesis)


def plausibility(
    mass: dict[frozenset, float], hypothesis: frozenset, frame: frozenset
) -> float:
    """Plausibility: 1 - Bel(complement of hypothesis)."""
    complement = frame - hypothesis
    return 1 - belief(mass, complement)


def uncertainty_gap(
    mass: dict[frozenset, float], stage: int, frame: frozenset
) -> float:
    """Pl(s_i) - Bel(s_i) — epistemic uncertainty interval width."""
    h = frozenset({stage})
    return plausibility(mass, h, frame) - belief(mass, h)


def cross_model_conflict(
    model_a_mass: dict[frozenset, float],
    model_b_mass: dict[frozenset, float],
) -> float:
    """Polarization measure: conflict between two model families."""
    _, k = combine(model_a_mass, model_b_mass)
    return k
