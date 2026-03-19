from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from judge_gym.mine_v3 import mine_v3_findings, render_markdown_summary, write_mining_summary


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def _write_csv(path: Path, rows: list[dict]) -> None:
    frame = pd.DataFrame(rows)
    frame.to_csv(path, index=False)


class MineV3Test(unittest.TestCase):
    def test_mine_v3_findings_ranks_and_labels(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            investigation_root = root / "investigation"
            tables_dir = investigation_root / "tables"
            tables_dir.mkdir(parents=True, exist_ok=True)

            _write_csv(
                tables_dir / "family_effects_qvalues.csv",
                [
                    {
                        "contrast_id": "c_infer",
                        "family_slug": "fam",
                        "contrast_kind": "k",
                        "baseline_tag": "a",
                        "variant_tag": "b",
                        "endpoint": "abstain_rate",
                        "n_samples": 2,
                        "mean_delta": 1.2,
                        "median_delta": 1.2,
                        "std_delta": 0.1,
                        "effect_size_dz": 1.7,
                        "positive_share": 1.0,
                        "ci_low": 1.0,
                        "ci_high": 1.4,
                        "sign_flip_pvalue": 0.01,
                        "qvalue": 0.01,
                        "is_significant_fdr_10": True,
                        "is_significant_fdr_05": True,
                    },
                    {
                        "contrast_id": "c_infer",
                        "family_slug": "fam",
                        "contrast_kind": "k",
                        "baseline_tag": "a",
                        "variant_tag": "b",
                        "endpoint": "singleton_rate",
                        "n_samples": 2,
                        "mean_delta": -0.8,
                        "median_delta": -0.8,
                        "std_delta": 0.2,
                        "effect_size_dz": 1.1,
                        "positive_share": 0.0,
                        "ci_low": -1.1,
                        "ci_high": -0.6,
                        "sign_flip_pvalue": 0.02,
                        "qvalue": 0.04,
                        "is_significant_fdr_10": True,
                        "is_significant_fdr_05": True,
                    },
                    {
                        "contrast_id": "c_desc",
                        "family_slug": "fam",
                        "contrast_kind": "k",
                        "baseline_tag": "a",
                        "variant_tag": "b",
                        "endpoint": "abstain_rate",
                        "n_samples": 2,
                        "mean_delta": 3.0,
                        "median_delta": 3.0,
                        "std_delta": 0.1,
                        "effect_size_dz": 3.0,
                        "positive_share": 1.0,
                        "ci_low": 2.5,
                        "ci_high": 3.5,
                        "sign_flip_pvalue": 0.0001,
                        "qvalue": 0.001,
                        "is_significant_fdr_10": True,
                        "is_significant_fdr_05": True,
                    },
                ],
            )
            _write_csv(
                tables_dir / "candidate_findings.csv",
                [
                    {
                        "finding_kind": "family_effect",
                        "subject": "ignored_family_effect",
                        "score": 99.0,
                        "summary": "ignored for descriptive list",
                    },
                    {
                        "finding_kind": "experiment_outlier",
                        "subject": "exp_x",
                        "score": -2.3,
                        "summary": "descriptive outlier",
                    },
                ],
            )
            _write_csv(
                tables_dir / "sample_instability.csv",
                [
                    {
                        "sample_ordinal": 1,
                        "instability_score": 1.1,
                    },
                    {
                        "sample_ordinal": 2,
                        "instability_score": 2.2,
                    },
                ],
            )
            _write_csv(
                tables_dir / "family_pair_deltas.csv",
                [
                    {
                        "contrast_id": "c_infer",
                        "sample_ordinal": 1,
                        "abstain_rate_delta": 1.3,
                        "singleton_rate_delta": -0.4,
                    },
                    {
                        "contrast_id": "c_infer",
                        "sample_ordinal": 2,
                        "abstain_rate_delta": 0.1,
                        "singleton_rate_delta": -0.2,
                    },
                    {
                        "contrast_id": "c_desc",
                        "sample_ordinal": 1,
                        "abstain_rate_delta": 9.0,
                        "singleton_rate_delta": 9.0,
                    },
                ],
            )

            contract_path = root / "analysis_contract.json"
            _write_json(
                contract_path,
                {
                    "outputs": {
                        "investigationRoot": str(investigation_root),
                    },
                    "contrastRegistry": {
                        "path": str(root / "v3_contrasts.json"),
                    },
                },
            )
            _write_json(
                root / "v3_contrasts.json",
                {
                    "contrasts": [
                        {"contrastId": "c_infer", "mode": "inferential"},
                        {"contrastId": "c_desc", "mode": "descriptive"},
                    ],
                },
            )

            mined = mine_v3_findings(contract_path=contract_path)

            inferential = mined["top_inferential_findings"]
            self.assertEqual(list(inferential["contrast_id"]), ["c_infer", "c_infer"])
            self.assertTrue((inferential["finding_scope"] == "inferential").all())
            self.assertEqual(inferential.iloc[0]["endpoint"], "abstain_rate")

            descriptive = mined["top_descriptive_findings"]
            self.assertEqual(len(descriptive), 1)
            self.assertEqual(descriptive.iloc[0]["finding_scope"], "descriptive")
            self.assertEqual(descriptive.iloc[0]["finding_type"], "experiment_outlier")

            unstable = mined["top_unstable_samples"]
            self.assertEqual(int(unstable.iloc[0]["sample_ordinal"]), 2)

            contributors = mined["top_effect_contributors"]
            self.assertEqual(int(contributors.iloc[0]["sample_ordinal"]), 1)
            self.assertIn("c_infer", str(contributors.iloc[0]["top_contributing_effect"]))

            ranked = mined["ranked_findings"]
            self.assertIn("inferential", set(ranked["finding_scope"]))
            self.assertIn("descriptive", set(ranked["finding_scope"]))

            summary = mined["summary"]
            self.assertEqual(summary["counts"]["inferential_findings"], 2)
            self.assertEqual(summary["counts"]["descriptive_findings"], 1)

    def test_render_and_write_summary_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            investigation_root = root / "investigation"
            tables_dir = investigation_root / "tables"
            tables_dir.mkdir(parents=True, exist_ok=True)

            _write_csv(
                tables_dir / "family_effects_qvalues.csv",
                [
                    {
                        "contrast_id": "c1",
                        "family_slug": "f",
                        "contrast_kind": "k",
                        "baseline_tag": "a",
                        "variant_tag": "b",
                        "endpoint": "abstain_rate",
                        "n_samples": 1,
                        "mean_delta": 0.2,
                        "median_delta": 0.2,
                        "std_delta": 0.1,
                        "effect_size_dz": 0.8,
                        "positive_share": 1.0,
                        "ci_low": 0.1,
                        "ci_high": 0.3,
                        "sign_flip_pvalue": 0.2,
                        "qvalue": 0.05,
                        "is_significant_fdr_10": True,
                        "is_significant_fdr_05": True,
                    }
                ],
            )
            _write_csv(
                tables_dir / "candidate_findings.csv",
                [
                    {
                        "finding_kind": "sample_instability",
                        "subject": "S01",
                        "score": 1.5,
                        "summary": "unstable",
                    }
                ],
            )
            _write_csv(
                tables_dir / "sample_instability.csv",
                [{"sample_ordinal": 1, "instability_score": 1.5}],
            )
            _write_csv(
                tables_dir / "family_pair_deltas.csv",
                [{"contrast_id": "c1", "sample_ordinal": 1, "abstain_rate_delta": 0.2}],
            )

            contract_path = root / "analysis_contract.json"
            _write_json(
                contract_path,
                {
                    "outputs": {
                        "investigationRoot": str(investigation_root),
                    },
                    "contrastRegistry": {
                        "path": str(root / "v3_contrasts.json"),
                    },
                },
            )
            _write_json(
                root / "v3_contrasts.json",
                {
                    "contrasts": [{"contrastId": "c1", "mode": "inferential"}],
                },
            )

            mined = mine_v3_findings(contract_path=contract_path)
            markdown = render_markdown_summary(mined, top_k=3)
            self.assertIn("Top Inferential Findings", markdown)
            self.assertIn("[inferential]", markdown)
            self.assertIn("Top Descriptive Findings", markdown)
            self.assertIn("[descriptive]", markdown)

            outputs = write_mining_summary(mined, output_dir=root / "out")
            self.assertTrue(outputs["ranked_findings_csv"].exists())
            self.assertTrue(outputs["summary_markdown"].exists())
            self.assertTrue(outputs["summary_json"].exists())


if __name__ == "__main__":
    unittest.main()
