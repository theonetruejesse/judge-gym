from __future__ import annotations

import unittest

import pandas as pd

from judge_gym.report_v4_native_openai import (
    _build_lane_summary,
    _build_provider_summary,
    _contrast_specs,
)


class V4NativeOpenAiReportTest(unittest.TestCase):
    def test_provider_and_lane_summaries_follow_canonical_groupings(self) -> None:
        experiment_metrics = pd.DataFrame(
            [
                {
                    "experiment_tag": "v4_native_fascism_baseline_source_gpt41",
                    "model": "gpt-4.1",
                    "concept": "fascism",
                    "condition_key": "baseline_source",
                    "mean_expected_stage": 1.5,
                    "abstain_rate": 0.0,
                    "singleton_rate": 0.7,
                    "mean_subset_size": 1.2,
                },
                {
                    "experiment_tag": "v4_native_fascism_abstention_source_gpt41",
                    "model": "gpt-4.1",
                    "concept": "fascism",
                    "condition_key": "abstention_source",
                    "mean_expected_stage": 1.8,
                    "abstain_rate": 0.2,
                    "singleton_rate": 0.6,
                    "mean_subset_size": 1.1,
                },
                {
                    "experiment_tag": "v4_native_fascism_baseline_source_gpt52",
                    "model": "gpt-5.2",
                    "concept": "fascism",
                    "condition_key": "baseline_source",
                    "mean_expected_stage": 1.7,
                    "abstain_rate": 0.0,
                    "singleton_rate": 0.65,
                    "mean_subset_size": 1.3,
                },
            ]
        )

        provider_summary = _build_provider_summary(experiment_metrics)
        lane_summary = _build_lane_summary(experiment_metrics)

        gpt41 = provider_summary.loc[provider_summary["model"] == "gpt-4.1"].iloc[0]
        self.assertEqual(int(gpt41["experiment_count"]), 2)
        self.assertAlmostEqual(float(gpt41["mean_expected_stage"]), 1.65, places=6)

        fascism_baseline = lane_summary.loc[
            (lane_summary["concept"] == "fascism")
            & (lane_summary["condition_key"] == "baseline_source")
        ].iloc[0]
        self.assertEqual(int(fascism_baseline["experiment_count"]), 2)
        self.assertAlmostEqual(float(fascism_baseline["mean_expected_stage"]), 1.6, places=6)

    def test_contrast_specs_cover_within_model_and_cross_model_surfaces(self) -> None:
        rows = [
            {"experiment_tag": "v4_native_fascism_baseline_source_gpt41"},
            {"experiment_tag": "v4_native_fascism_abstention_source_gpt41"},
            {"experiment_tag": "v4_native_fascism_view_l2_neutralized_gpt41"},
            {"experiment_tag": "v4_native_illiberal_democracy_baseline_source_gpt41"},
            {"experiment_tag": "v4_native_illiberal_democracy_view_l2_neutralized_gpt41"},
            {"experiment_tag": "v4_native_fascism_baseline_source_gpt52"},
        ]
        specs = _contrast_specs(rows)
        contrast_ids = {spec.contrast_id for spec in specs}
        self.assertIn("gpt41:fascism:baseline_vs_abstention", contrast_ids)
        self.assertIn("gpt41:fascism:source_vs_l2", contrast_ids)
        self.assertIn("gpt41:baseline:fascism_vs_illiberal_democracy", contrast_ids)
        self.assertIn("fascism_baseline_source:gpt52_vs_gpt41", contrast_ids)


if __name__ == "__main__":
    unittest.main()
