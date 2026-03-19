from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

from judge_gym.report_v3 import assemble_v3_report


def _write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        raise ValueError("rows must be non-empty for CSV fixtures")
    fieldnames = list(rows[0].keys())
    with path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


class V3ReportAssemblerTest(unittest.TestCase):
    def test_assemble_v3_report_writes_structured_markdown(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            blueprints = root / "_blueprints" / "v3-analysis-process"
            contracts_dir = root / "packages" / "analysis" / "contracts"
            tables_dir = root / "packages" / "analysis" / "_outputs" / "v3" / "investigation" / "tables"
            figures_dir = root / "packages" / "analysis" / "_outputs" / "v3" / "investigation" / "figures" / "curated"

            contracts_dir.mkdir(parents=True, exist_ok=True)
            figures_dir.mkdir(parents=True, exist_ok=True)
            (figures_dir / "hero.png").write_bytes(b"png")

            contrast_registry = {
                "registryVersion": "v1",
                "contrasts": [
                    {
                        "contrastId": "family:x__vs__y",
                        "mode": "inferential",
                    },
                    {
                        "contrastId": "family:a__vs__b",
                        "mode": "descriptive_only",
                    },
                ],
            }
            (contracts_dir / "v3_contrasts.json").write_text(json.dumps(contrast_registry))

            _write_csv(
                tables_dir / "family_effects.csv",
                [
                    {
                        "contrast_id": "family:x__vs__y",
                        "endpoint": "abstain_rate",
                        "mean_delta": "0.20",
                        "ci_low": "0.10",
                        "ci_high": "0.30",
                        "sign_flip_pvalue": "0.01",
                    },
                    {
                        "contrast_id": "family:a__vs__b",
                        "endpoint": "abstain_rate",
                        "mean_delta": "-0.10",
                        "ci_low": "-0.20",
                        "ci_high": "-0.01",
                        "sign_flip_pvalue": "0.04",
                    },
                ],
            )
            _write_csv(
                tables_dir / "matching_validation.csv",
                [
                    {"contrast_id": "family:x__vs__y", "fully_matched": "True"},
                    {"contrast_id": "family:a__vs__b", "fully_matched": "False"},
                ],
            )
            _write_csv(
                tables_dir / "sample_instability.csv",
                [
                    {
                        "sample_ordinal": "7",
                        "instability_score": "1.3",
                        "experiment_count": "5",
                        "abstain_rate_std": "0.2",
                        "mean_subset_size_std": "0.3",
                    }
                ],
            )
            _write_csv(
                tables_dir / "scale_certainty_effects.csv",
                [
                    {
                        "contrast_id": "scale:base__vs__variant",
                        "model_id": "gpt-4.1",
                        "baseline_scale_size": "4",
                        "variant_scale_size": "5",
                        "endpoint": "abstain_rate",
                        "mean_delta": "-0.1",
                        "ci_low": "-0.2",
                        "ci_high": "-0.01",
                    }
                ],
            )
            _write_csv(
                tables_dir / "scale_certainty_regression.csv",
                [
                    {
                        "term": "Intercept",
                        "coef": "1.0",
                        "stderr": "0.1",
                        "pvalue": "0.001",
                        "conf_low": "0.8",
                        "conf_high": "1.2",
                        "r_squared": "0.4",
                        "n_obs": "200",
                    }
                ],
            )

            contract = {
                "contractVersion": 1,
                "dataSource": {"exportSchemaVersion": 3, "snapshotIds": ["s1"]},
                "inclusion": {"includeTags": ["x"], "excludeTags": ["y"]},
                "contrastRegistry": {"path": "../../packages/analysis/contracts/v3_contrasts.json"},
                "endpoints": {"primary": ["abstain_rate"]},
                "spotChecks": {"topKUnstableSamples": 1},
                "outputs": {"investigationRoot": "../../packages/analysis/_outputs/v3/investigation"},
            }
            blueprints.mkdir(parents=True, exist_ok=True)
            contract_path = blueprints / "analysis_contract.json"
            contract_path.write_text(json.dumps(contract))

            figure_manifest = {
                "manifestVersion": 1,
                "figures": [
                    {
                        "figureId": "hero_one",
                        "tier": "hero",
                        "path": "packages/analysis/_outputs/v3/investigation/figures/curated/hero.png",
                        "readability": {"status": "report_grade", "knownIssues": []},
                    }
                ],
            }
            manifest_path = blueprints / "figures_manifest.json"
            manifest_path.write_text(json.dumps(figure_manifest))

            report_path = blueprints / "report.md"
            assembled = assemble_v3_report(
                contract_path=contract_path,
                figure_manifest_path=manifest_path,
                output_path=report_path,
            )
            self.assertEqual(assembled, report_path.resolve())
            text = report_path.read_text()
            self.assertIn("## Inferential Findings", text)
            self.assertIn("## Descriptive Findings", text)
            self.assertIn("## Spot Checks", text)
            self.assertIn("## Aggregation Sensitivity", text)
            self.assertIn("## Appendix Figure Inventory", text)
            self.assertIn("family:x__vs__y", text)
            self.assertIn("family:a__vs__b", text)
            self.assertIn("hero_one", text)

    def test_assemble_v3_report_handles_missing_optional_tables(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            blueprints = root / "_blueprints" / "v3-analysis-process"
            contracts_dir = root / "packages" / "analysis" / "contracts"
            tables_dir = root / "packages" / "analysis" / "_outputs" / "v3" / "investigation" / "tables"

            contracts_dir.mkdir(parents=True, exist_ok=True)
            blueprints.mkdir(parents=True, exist_ok=True)
            tables_dir.mkdir(parents=True, exist_ok=True)

            (contracts_dir / "v3_contrasts.json").write_text(
                json.dumps({"registryVersion": "v1", "contrasts": []})
            )
            _write_csv(
                tables_dir / "family_effects.csv",
                [
                    {
                        "contrast_id": "noop",
                        "endpoint": "abstain_rate",
                        "mean_delta": "0",
                        "ci_low": "0",
                        "ci_high": "0",
                        "sign_flip_pvalue": "1",
                    }
                ],
            )

            contract = {
                "contractVersion": 1,
                "dataSource": {"exportSchemaVersion": 3, "snapshotIds": []},
                "inclusion": {"includeTags": [], "excludeTags": []},
                "contrastRegistry": {"path": "../../packages/analysis/contracts/v3_contrasts.json"},
                "endpoints": {"primary": ["abstain_rate"]},
                "spotChecks": {"topKUnstableSamples": 1},
                "outputs": {"investigationRoot": "../../packages/analysis/_outputs/v3/investigation"},
            }
            contract_path = blueprints / "analysis_contract.json"
            contract_path.write_text(json.dumps(contract))
            manifest_path = blueprints / "figures_manifest.json"
            manifest_path.write_text(json.dumps({"manifestVersion": 1, "figures": []}))

            report_path = blueprints / "report.md"
            assemble_v3_report(
                contract_path=contract_path,
                figure_manifest_path=manifest_path,
                output_path=report_path,
            )
            text = report_path.read_text()
            self.assertIn("family_effects_qvalues.csv", text)
            self.assertIn("| sample_instability.csv | missing |", text)


if __name__ == "__main__":
    unittest.main()
