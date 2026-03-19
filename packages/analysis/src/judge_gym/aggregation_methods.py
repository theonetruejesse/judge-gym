from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

import numpy as np
from pyds import MassFunction

_ABSTAIN_POLICIES = {"zeros", "uniform"}


@dataclass(frozen=True)
class BeliefAggregationResult:
    method: str
    scale_size: int
    combined_count: int
    abstain_count: int
    conflict: float
    stage_probabilities: tuple[float, ...]


@dataclass(frozen=True)
class VerdictObservation:
    decoded_scores: tuple[int, ...]
    abstained: bool = False
    weight: float = 1.0


def canonicalize_stage_set(decoded_scores: Sequence[int] | None, scale_size: int) -> tuple[int, ...]:
    if scale_size < 2:
        raise ValueError("scale_size must be at least 2")
    if decoded_scores is None:
        return ()
    canonical = sorted({int(stage) for stage in decoded_scores})
    for stage in canonical:
        if stage < 1 or stage > scale_size:
            raise ValueError(f"stage {stage} is outside 1..{scale_size}")
    return tuple(canonical)


def verdict_to_stage_probabilities(
    decoded_scores: Sequence[int] | None,
    scale_size: int,
    *,
    abstained: bool = False,
    abstain_policy: str = "zeros",
) -> np.ndarray:
    if abstain_policy not in _ABSTAIN_POLICIES:
        raise ValueError(f"unsupported abstain_policy={abstain_policy!r}")
    stage_set = canonicalize_stage_set(decoded_scores, scale_size)

    if abstained or not stage_set:
        if abstain_policy == "zeros":
            return np.zeros(scale_size, dtype=float)
        return np.full(scale_size, 1.0 / scale_size, dtype=float)

    probabilities = np.zeros(scale_size, dtype=float)
    share = 1.0 / len(stage_set)
    for stage in stage_set:
        probabilities[stage - 1] = share
    return probabilities


def weighted_linear_opinion_pool(
    stage_vectors: Sequence[Sequence[float] | np.ndarray],
    *,
    weights: Sequence[float] | None = None,
    skip_zero_vectors: bool = True,
) -> np.ndarray:
    matrix = _prepare_stage_matrix(stage_vectors, skip_zero_vectors=skip_zero_vectors)
    if matrix.size == 0:
        if stage_vectors:
            return np.zeros(len(stage_vectors[0]), dtype=float)
        return np.array([], dtype=float)

    resolved_weights = _resolve_weights(matrix.shape[0], weights)
    pooled = np.average(matrix, axis=0, weights=resolved_weights)
    return _normalize_vector(pooled)


def log_opinion_pool(
    stage_vectors: Sequence[Sequence[float] | np.ndarray],
    *,
    weights: Sequence[float] | None = None,
    epsilon: float = 1e-12,
    skip_zero_vectors: bool = True,
) -> np.ndarray:
    if epsilon <= 0.0:
        raise ValueError("epsilon must be positive")
    matrix = _prepare_stage_matrix(stage_vectors, skip_zero_vectors=skip_zero_vectors)
    if matrix.size == 0:
        if stage_vectors:
            return np.zeros(len(stage_vectors[0]), dtype=float)
        return np.array([], dtype=float)

    resolved_weights = _resolve_weights(matrix.shape[0], weights)
    matrix = np.clip(matrix, epsilon, 1.0)
    log_prob = np.log(matrix)
    weighted_log_mean = np.average(log_prob, axis=0, weights=resolved_weights)
    pooled = np.exp(weighted_log_mean)
    return _normalize_vector(pooled)


def geometry_support_summary(
    observations: Sequence[VerdictObservation],
    scale_size: int,
    *,
    abstain_policy: str = "zeros",
) -> dict[str, float]:
    if not observations:
        return {
            "n_observations": 0.0,
            "abstain_rate": math.nan,
            "singleton_rate": math.nan,
            "mean_subset_size": math.nan,
            "expected_stage": math.nan,
            "mid_scale_mass": math.nan,
            "stage_entropy": math.nan,
        }

    abstained = np.array([obs.abstained or len(obs.decoded_scores) == 0 for obs in observations], dtype=bool)
    subset_sizes = np.array(
        [len(canonicalize_stage_set(obs.decoded_scores, scale_size)) for obs in observations],
        dtype=float,
    )
    singleton = np.where(subset_sizes == 1, 1.0, 0.0)
    vectors = np.vstack(
        [
            verdict_to_stage_probabilities(
                obs.decoded_scores,
                scale_size,
                abstained=obs.abstained,
                abstain_policy=abstain_policy,
            )
            for obs in observations
        ]
    )

    non_abstain_mask = ~abstained
    if non_abstain_mask.any():
        non_abstain_vectors = vectors[non_abstain_mask]
        mean_distribution = _normalize_vector(non_abstain_vectors.mean(axis=0))
        expected_stage = float(np.dot(mean_distribution, np.arange(1, scale_size + 1)))
        if scale_size > 2:
            mid_scale_mass = float(mean_distribution[1:-1].sum())
        else:
            mid_scale_mass = 0.0
        stage_entropy = _normalized_entropy(mean_distribution)
        singleton_rate = float(singleton[non_abstain_mask].mean())
        mean_subset_size = float(subset_sizes[non_abstain_mask].mean())
    else:
        expected_stage = math.nan
        mid_scale_mass = math.nan
        stage_entropy = math.nan
        singleton_rate = math.nan
        mean_subset_size = math.nan

    return {
        "n_observations": float(len(observations)),
        "abstain_rate": float(abstained.mean()),
        "singleton_rate": singleton_rate,
        "mean_subset_size": mean_subset_size,
        "expected_stage": expected_stage,
        "mid_scale_mass": mid_scale_mass,
        "stage_entropy": stage_entropy,
    }


def response_to_mass(
    *,
    decoded_scores: Sequence[int] | None,
    scale_size: int,
    abstained: bool,
    score_expert_agreement_prob: float | None = 1.0,
    rubric_observability_score: float | None = 1.0,
    rubric_discriminability_score: float | None = 1.0,
    closed_world: bool,
) -> MassFunction | None:
    theta = frozenset(range(1, scale_size + 1))
    agreement = _clamp_unit(score_expert_agreement_prob if score_expert_agreement_prob is not None else 1.0)

    stage_set = canonicalize_stage_set(decoded_scores, scale_size)
    is_abstain = abstained or len(stage_set) == 0
    if is_abstain:
        if closed_world:
            return None
        mass = MassFunction()
        mass[frozenset()] = agreement
        mass[theta] = 1.0 - agreement
        return mass

    verdict = frozenset(stage_set)
    if verdict == theta:
        mass = MassFunction()
        if closed_world:
            mass[theta] = 1.0
        else:
            mass[theta] = agreement
            mass[frozenset()] = 1.0 - agreement
        return mass

    if closed_world:
        verdict_mass = agreement
    else:
        verdict_mass = _clamp_unit(
            agreement
            * _clamp_unit(rubric_observability_score if rubric_observability_score is not None else 1.0)
            * _clamp_unit(rubric_discriminability_score if rubric_discriminability_score is not None else 1.0)
        )
    return MassFunction({verdict: verdict_mass, theta: 1.0 - verdict_mass})


def aggregate_local_tbm(
    responses: Sequence[Mapping[str, object]],
    *,
    scale_size: int,
) -> BeliefAggregationResult | None:
    return _aggregate_local_belief(responses, scale_size=scale_size, closed_world=False)


def aggregate_local_closed_world(
    responses: Sequence[Mapping[str, object]],
    *,
    scale_size: int,
) -> BeliefAggregationResult | None:
    return _aggregate_local_belief(responses, scale_size=scale_size, closed_world=True)


def _aggregate_local_belief(
    responses: Sequence[Mapping[str, object]],
    *,
    scale_size: int,
    closed_world: bool,
) -> BeliefAggregationResult | None:
    masses: list[MassFunction] = []
    abstain_count = 0
    for response in responses:
        decoded_scores = response.get("decoded_scores")
        abstained = bool(response.get("abstained", False))
        if abstained or not decoded_scores:
            abstain_count += 1
        mass = response_to_mass(
            decoded_scores=decoded_scores if isinstance(decoded_scores, Sequence) else (),
            scale_size=scale_size,
            abstained=abstained,
            score_expert_agreement_prob=_float_or_default(response.get("score_expert_agreement_prob"), 1.0),
            rubric_observability_score=_float_or_default(response.get("rubric_observability_score"), 1.0),
            rubric_discriminability_score=_float_or_default(response.get("rubric_discriminability_score"), 1.0),
            closed_world=closed_world,
        )
        if mass is not None:
            masses.append(mass)

    if not masses:
        return None

    if closed_world:
        combined_unnormalized = masses[0]
        conflict = 0.0
        for mass in masses[1:]:
            combined_unnormalized = combined_unnormalized.combine_conjunctive(
                mass,
                normalization=False,
            )
            conflict = float(combined_unnormalized[frozenset()])

        if conflict >= 0.9999:
            combined = combined_unnormalized
        else:
            combined = masses[0]
            for mass in masses[1:]:
                combined = combined.combine_conjunctive(
                    mass,
                    normalization=True,
                )
    else:
        combined = masses[0]
        conflict = float(combined[frozenset()])
        for mass in masses[1:]:
            combined = combined.combine_conjunctive(
                mass,
                normalization=False,
            )
            conflict = float(combined[frozenset()])

    if conflict >= 0.9999:
        stage_probabilities = tuple(0.0 for _ in range(scale_size))
    else:
        pignistic = combined.pignistic()
        stage_probabilities = tuple(
            float(pignistic.get(frozenset([stage]), 0.0))
            for stage in range(1, scale_size + 1)
        )

    return BeliefAggregationResult(
        method="closed_world" if closed_world else "tbm",
        scale_size=scale_size,
        combined_count=len(masses),
        abstain_count=abstain_count,
        conflict=float(conflict),
        stage_probabilities=stage_probabilities,
    )


def _prepare_stage_matrix(
    stage_vectors: Sequence[Sequence[float] | np.ndarray],
    *,
    skip_zero_vectors: bool,
) -> np.ndarray:
    if not stage_vectors:
        return np.array([], dtype=float)
    matrix = np.asarray(stage_vectors, dtype=float)
    if matrix.ndim != 2:
        raise ValueError("stage_vectors must be a 2D matrix-like sequence")
    if matrix.shape[1] == 0:
        raise ValueError("stage_vectors must include at least one stage")
    if np.any(matrix < 0.0):
        raise ValueError("stage_vectors must be non-negative")

    row_sums = matrix.sum(axis=1)
    keep_mask = row_sums > 0.0
    if skip_zero_vectors:
        matrix = matrix[keep_mask]
        row_sums = row_sums[keep_mask]
        if matrix.size == 0:
            return matrix
    elif np.any(~keep_mask):
        raise ValueError("encountered zero-sum stage vector with skip_zero_vectors=False")

    return matrix / row_sums[:, None]


def _resolve_weights(count: int, weights: Sequence[float] | None) -> np.ndarray:
    if count == 0:
        return np.array([], dtype=float)
    if weights is None:
        return np.ones(count, dtype=float) / count
    if len(weights) != count:
        raise ValueError("weights length must match the number of retained stage vectors")
    resolved = np.asarray(weights, dtype=float)
    if np.any(resolved < 0.0):
        raise ValueError("weights must be non-negative")
    total = resolved.sum()
    if total <= 0.0:
        raise ValueError("weights must contain at least one positive value")
    return resolved / total


def _normalized_entropy(probabilities: np.ndarray) -> float:
    probs = _normalize_vector(probabilities)
    positive = probs[probs > 0.0]
    if positive.size == 0:
        return 0.0
    entropy = float(-(positive * np.log2(positive)).sum())
    max_entropy = math.log2(len(probabilities))
    if max_entropy <= 0.0:
        return 0.0
    return entropy / max_entropy


def _normalize_vector(values: Sequence[float] | np.ndarray) -> np.ndarray:
    vector = np.asarray(values, dtype=float)
    total = float(vector.sum())
    if total <= 0.0:
        return np.zeros_like(vector)
    return vector / total


def _clamp_unit(value: float | int | None) -> float:
    if value is None:
        return 1.0
    numeric = float(value)
    return max(0.0, min(1.0, numeric))


def _float_or_default(value: object, default: float) -> float:
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
