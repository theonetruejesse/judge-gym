from __future__ import annotations

import unittest

import pandas as pd

from judge_gym.report_v4_native import (
    _build_contrast_metrics,
    _build_experiment_metrics,
    _contrast_specs,
)


class V4NativeReportTest(unittest.TestCase):
    def test_experiment_metrics_and_contrasts_follow_v3_geometry_conventions(self) -> None:
        responses = pd.DataFrame(
            [
                {
                    "experiment_tag": "v4_native_fascism_baseline_source_gpt41",
                    "decoded_scores": [2],
                    "abstained": False,
                    "subset_size": 1,
                    "expected_stage": 2.0,
                    "is_singleton": True,
                    "geometry_bucket": "singleton",
                    "score_expert_agreement_prob": 0.8,
                    "sample_ordinal": 1,
                    "evidence_item_ids": ["item-1"],
                    "evidence_labels": ["E1"],
                    "evidence_titles": ["Title 1"],
                    "evidence_urls": ["https://example.com/1"],
                    "decoded_signature": "2",
                },
                {
                    "experiment_tag": "v4_native_fascism_baseline_source_gpt41",
                    "decoded_scores": [2, 3],
                    "abstained": False,
                    "subset_size": 2,
                    "expected_stage": 2.5,
                    "is_singleton": False,
                    "geometry_bucket": "adjacent_subset",
                    "score_expert_agreement_prob": 0.6,
                    "sample_ordinal": 1,
                    "evidence_item_ids": ["item-2"],
                    "evidence_labels": ["E2"],
                    "evidence_titles": ["Title 2"],
                    "evidence_urls": ["https://example.com/2"],
                    "decoded_signature": "2|3",
                },
                {
                    "experiment_tag": "v4_native_fascism_abstention_source_gpt41",
                    "decoded_scores": [],
                    "abstained": True,
                    "subset_size": 0,
                    "expected_stage": float("nan"),
                    "is_singleton": False,
                    "geometry_bucket": "abstain",
                    "score_expert_agreement_prob": 0.4,
                    "sample_ordinal": 1,
                    "evidence_item_ids": ["item-1"],
                    "evidence_labels": ["E1"],
                    "evidence_titles": ["Title 1"],
                    "evidence_urls": ["https://example.com/1"],
                    "decoded_signature": "",
                },
                {
                    "experiment_tag": "v4_native_fascism_abstention_source_gpt41",
                    "decoded_scores": [3],
                    "abstained": False,
                    "subset_size": 1,
                    "expected_stage": 3.0,
                    "is_singleton": True,
                    "geometry_bucket": "singleton",
                    "score_expert_agreement_prob": 0.9,
                    "sample_ordinal": 1,
                    "evidence_item_ids": ["item-2"],
                    "evidence_labels": ["E2"],
                    "evidence_titles": ["Title 2"],
                    "evidence_urls": ["https://example.com/2"],
                    "decoded_signature": "3",
                },
            ]
        )
        experiments = {
            "v4_native_fascism_baseline_source_gpt41": {
                "concept": "fascism",
                "scale_size": 4,
                "evidence_view": "source_text",
                "abstain_enabled": False,
            },
            "v4_native_fascism_abstention_source_gpt41": {
                "concept": "fascism",
                "scale_size": 4,
                "evidence_view": "source_text",
                "abstain_enabled": True,
            },
        }

        experiment_metrics = _build_experiment_metrics(responses=responses, experiments=experiments)
        baseline = experiment_metrics.loc[
            experiment_metrics["experiment_tag"] == "v4_native_fascism_baseline_source_gpt41"
        ].iloc[0]
        self.assertAlmostEqual(float(baseline["abstain_rate"]), 0.0, places=6)
        self.assertAlmostEqual(float(baseline["singleton_rate"]), 0.5, places=6)
        self.assertAlmostEqual(float(baseline["mean_subset_size"]), 1.5, places=6)
        self.assertAlmostEqual(float(baseline["mean_expected_stage"]), 2.25, places=6)

        abstention = experiment_metrics.loc[
            experiment_metrics["experiment_tag"] == "v4_native_fascism_abstention_source_gpt41"
        ].iloc[0]
        self.assertAlmostEqual(float(abstention["abstain_rate"]), 0.5, places=6)

        contrasts = _build_contrast_metrics(
            responses=responses,
            contrast_specs=[_contrast_specs()[0]],
        )
        row = contrasts.iloc[0]
        self.assertEqual(row["contrast_id"], "fascism:baseline_vs_abstention")
        self.assertAlmostEqual(float(row["flip_rate"]), 1.0, places=6)
        self.assertAlmostEqual(float(row["abstain_delta"]), 0.5, places=6)
        self.assertAlmostEqual(float(row["mean_subset_size_delta"]), -1.0, places=6)


if __name__ == "__main__":
    unittest.main()
