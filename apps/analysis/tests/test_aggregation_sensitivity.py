from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from judge_gym.aggregation_sensitivity import (
    _METHOD_ORDER,
    compute_sample_method_metrics,
    summarize_method_sensitivity,
    write_aggregation_sensitivity_outputs,
)


def _responses_frame() -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    # Baseline experiment: centered on stage 1.
    rows.extend(
        [
            {
                "experiment_tag": "exp_base",
                "sample_ordinal": 1,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [1],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
            {
                "experiment_tag": "exp_base",
                "sample_ordinal": 1,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [1],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
        ]
    )
    # Variant experiment: centered on stage 3.
    rows.extend(
        [
            {
                "experiment_tag": "exp_variant",
                "sample_ordinal": 1,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [3],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
            {
                "experiment_tag": "exp_variant",
                "sample_ordinal": 1,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [3],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
        ]
    )
    # Conflict-heavy sample to exercise TBM/closed-world conflict.
    rows.extend(
        [
            {
                "experiment_tag": "exp_conflict",
                "sample_ordinal": 2,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [1],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
            {
                "experiment_tag": "exp_conflict",
                "sample_ordinal": 2,
                "model": "gpt-4.1",
                "scale_size": 4,
                "decoded_scores": [4],
                "abstained": False,
                "score_expert_agreement_prob": 1.0,
                "rubric_observability_score": 1.0,
                "rubric_discriminability_score": 1.0,
            },
        ]
    )
    return pd.DataFrame(rows)


class AggregationSensitivityTests(unittest.TestCase):
    def test_compute_sample_method_metrics_emits_all_methods(self) -> None:
        sample_methods = compute_sample_method_metrics(_responses_frame())
        self.assertEqual(
            set(sample_methods["method"].astype(str).unique().tolist()),
            set(_METHOD_ORDER),
        )

        base_weighted = sample_methods[
            (sample_methods["experiment_tag"] == "exp_base")
            & (sample_methods["sample_ordinal"] == 1)
            & (sample_methods["method"].astype(str) == "weighted_linear_pool")
        ].iloc[0]
        variant_weighted = sample_methods[
            (sample_methods["experiment_tag"] == "exp_variant")
            & (sample_methods["sample_ordinal"] == 1)
            & (sample_methods["method"].astype(str) == "weighted_linear_pool")
        ].iloc[0]
        self.assertAlmostEqual(float(base_weighted["expected_stage"]), 1.0, places=6)
        self.assertAlmostEqual(float(variant_weighted["expected_stage"]), 3.0, places=6)

        conflict_tbm = sample_methods[
            (sample_methods["experiment_tag"] == "exp_conflict")
            & (sample_methods["sample_ordinal"] == 2)
            & (sample_methods["method"].astype(str) == "local_tbm")
        ].iloc[0]
        self.assertGreaterEqual(float(conflict_tbm["conflict"]), 0.9999)

    def test_summarize_method_sensitivity_builds_contrast_deltas(self) -> None:
        sample_methods = compute_sample_method_metrics(_responses_frame())
        contrast_registry = pd.DataFrame(
            [
                {
                    "contrast_id": "contrast:test",
                    "family_slug": "test_family",
                    "contrast_kind": "synthetic",
                    "baseline_tag": "exp_base",
                    "variant_tag": "exp_variant",
                }
            ],
        )
        outputs = summarize_method_sensitivity(
            sample_methods,
            contrast_registry=contrast_registry,
            reference_method="weighted_linear_pool",
        )

        self.assertFalse(outputs.method_summary.empty)
        self.assertFalse(outputs.method_alignment.empty)
        self.assertFalse(outputs.contrast_sensitivity.empty)
        self.assertFalse(outputs.report_panel.empty)

        weighted_expected = outputs.contrast_sensitivity[
            (outputs.contrast_sensitivity["contrast_id"] == "contrast:test")
            & (outputs.contrast_sensitivity["method"].astype(str) == "weighted_linear_pool")
            & (outputs.contrast_sensitivity["endpoint"] == "expected_stage")
        ].iloc[0]
        self.assertAlmostEqual(float(weighted_expected["mean_delta"]), 2.0, places=6)
        self.assertEqual(int(weighted_expected["n_pairs"]), 1)

    def test_write_outputs_persists_compact_tables(self) -> None:
        sample_methods = compute_sample_method_metrics(_responses_frame())
        outputs = summarize_method_sensitivity(
            sample_methods,
            contrast_registry=pd.DataFrame(
                [
                    {
                        "contrast_id": "contrast:test",
                        "family_slug": "test_family",
                        "contrast_kind": "synthetic",
                        "baseline_tag": "exp_base",
                        "variant_tag": "exp_variant",
                    }
                ],
            ),
        )
        with tempfile.TemporaryDirectory() as tmp_dir:
            paths = write_aggregation_sensitivity_outputs(outputs, output_dir=tmp_dir)
            self.assertEqual(
                set(paths.keys()),
                {
                    "sample_methods",
                    "method_summary",
                    "method_alignment",
                    "contrast_sensitivity",
                    "report_panel",
                },
            )
            for path in paths.values():
                self.assertTrue(Path(path).exists())
                frame = pd.read_csv(path)
                self.assertGreaterEqual(len(frame), 1)

        # Sanity check: weighted and log pools should stay close on deterministic singleton votes.
        summary = outputs.method_summary.set_index("method")
        weighted = float(summary.loc["weighted_linear_pool", "mean_expected_stage"])
        logged = float(summary.loc["log_opinion_pool", "mean_expected_stage"])
        self.assertTrue(np.isfinite(weighted))
        self.assertTrue(np.isfinite(logged))
        self.assertLess(abs(weighted - logged), 0.2)


if __name__ == "__main__":
    unittest.main()
