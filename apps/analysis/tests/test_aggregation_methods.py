from __future__ import annotations

import math
import unittest

import numpy as np

from judge_gym.aggregation_methods import (
    VerdictObservation,
    aggregate_local_closed_world,
    aggregate_local_tbm,
    canonicalize_stage_set,
    geometry_support_summary,
    log_opinion_pool,
    response_to_mass,
    verdict_to_stage_probabilities,
    weighted_linear_opinion_pool,
)


class AggregationMethodsTest(unittest.TestCase):
    def test_canonicalize_stage_set_and_bounds(self) -> None:
        self.assertEqual(canonicalize_stage_set([3, 2, 3, 1], 4), (1, 2, 3))
        self.assertEqual(canonicalize_stage_set(None, 4), ())
        with self.assertRaises(ValueError):
            canonicalize_stage_set([0], 4)

    def test_verdict_to_stage_probabilities_cases(self) -> None:
        abstain = verdict_to_stage_probabilities([], 5, abstained=True)
        singleton = verdict_to_stage_probabilities([4], 5)
        adjacent = verdict_to_stage_probabilities([2, 3], 5)
        broad = verdict_to_stage_probabilities([1, 3, 5], 5)

        self.assertTrue(np.allclose(abstain, np.zeros(5)))
        self.assertTrue(np.allclose(singleton, [0.0, 0.0, 0.0, 1.0, 0.0]))
        self.assertTrue(np.allclose(adjacent, [0.0, 0.5, 0.5, 0.0, 0.0]))
        self.assertTrue(np.allclose(broad, [1.0 / 3.0, 0.0, 1.0 / 3.0, 0.0, 1.0 / 3.0]))

    def test_weighted_linear_opinion_pool_respects_weights(self) -> None:
        vectors = [
            verdict_to_stage_probabilities([1], 4),
            verdict_to_stage_probabilities([4], 4),
        ]
        pooled = weighted_linear_opinion_pool(vectors, weights=[0.8, 0.2])
        self.assertAlmostEqual(float(pooled[0]), 0.8, places=6)
        self.assertAlmostEqual(float(pooled[3]), 0.2, places=6)
        self.assertAlmostEqual(float(pooled.sum()), 1.0, places=6)

    def test_log_opinion_pool_prefers_consensus(self) -> None:
        vectors = [
            verdict_to_stage_probabilities([1, 2], 4),
            verdict_to_stage_probabilities([2, 3], 4),
            verdict_to_stage_probabilities([2], 4),
        ]
        pooled = log_opinion_pool(vectors)
        self.assertEqual(int(np.argmax(pooled)), 1)  # stage 2
        self.assertAlmostEqual(float(pooled.sum()), 1.0, places=6)

    def test_geometry_support_summary_tracks_abstain_and_subset_behavior(self) -> None:
        observations = [
            VerdictObservation((2,), abstained=False),
            VerdictObservation((2, 3), abstained=False),
            VerdictObservation((1, 3, 4), abstained=False),
            VerdictObservation((), abstained=True),
        ]
        summary = geometry_support_summary(observations, 4)
        self.assertAlmostEqual(summary["abstain_rate"], 0.25, places=6)
        self.assertAlmostEqual(summary["singleton_rate"], 1.0 / 3.0, places=6)
        self.assertAlmostEqual(summary["mean_subset_size"], 2.0, places=6)
        self.assertTrue(1.0 <= summary["expected_stage"] <= 4.0)
        self.assertTrue(0.0 <= summary["mid_scale_mass"] <= 1.0)
        self.assertTrue(0.0 <= summary["stage_entropy"] <= 1.0)

    def test_response_to_mass_closed_world_skips_abstain(self) -> None:
        mass = response_to_mass(
            decoded_scores=[],
            scale_size=4,
            abstained=True,
            score_expert_agreement_prob=0.9,
            closed_world=True,
        )
        self.assertIsNone(mass)

    def test_local_tbm_detects_full_conflict_for_opposite_singletons(self) -> None:
        responses = [
            {
                "decoded_scores": [1],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
            {
                "decoded_scores": [4],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
        ]
        result = aggregate_local_tbm(responses, scale_size=4)
        self.assertIsNotNone(result)
        assert result is not None
        self.assertGreaterEqual(result.conflict, 0.9999)
        self.assertEqual(result.stage_probabilities, (0.0, 0.0, 0.0, 0.0))

    def test_local_closed_world_ignores_abstain_rows(self) -> None:
        responses = [
            {
                "decoded_scores": [],
                "abstained": True,
                "score_expert_agreement_prob": 0.9,
            },
            {
                "decoded_scores": [2],
                "abstained": False,
                "score_expert_agreement_prob": 0.8,
            },
        ]
        result = aggregate_local_closed_world(responses, scale_size=4)
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result.combined_count, 1)
        self.assertEqual(result.abstain_count, 1)
        self.assertLess(result.conflict, 1e-9)
        self.assertAlmostEqual(sum(result.stage_probabilities), 1.0, places=6)
        self.assertGreater(result.stage_probabilities[1], result.stage_probabilities[0])
        self.assertGreater(result.stage_probabilities[1], result.stage_probabilities[2])

    def test_pooling_rejects_bad_inputs(self) -> None:
        with self.assertRaises(ValueError):
            weighted_linear_opinion_pool([[1.0, -1.0]])
        with self.assertRaises(ValueError):
            weighted_linear_opinion_pool([[0.0, 0.0]], skip_zero_vectors=False)
        with self.assertRaises(ValueError):
            log_opinion_pool([[0.5, 0.5]], epsilon=0.0)
        with self.assertRaises(ValueError):
            verdict_to_stage_probabilities([1], 3, abstain_policy="bad")


if __name__ == "__main__":
    unittest.main()
