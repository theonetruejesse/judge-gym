from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from judge_gym.cache import connect_cache, create_snapshot, mark_snapshot_completed, write_snapshot_dataset
from judge_gym.investigate_v3 import generate_v3_investigation


def _manifest(
    experiment_tag: str,
    abstain_enabled: bool,
    *,
    model_id: str = "gpt-4.1",
    scale_size: int = 4,
    evidence_view: str = "l2_neutralized",
    evidence_bundle_size: int = 1,
    bundle_strategy: str | None = None,
) -> dict:
    return {
        "export_schema_version": 1,
        "experiment": {
            "experiment_id": f"exp_{experiment_tag}",
            "experiment_tag": experiment_tag,
            "pool_id": "pool_1",
            "pool_tag": "pool-tag",
            "evidence_count": 2,
            "model_id": model_id,
            "rubric_model": model_id,
            "scoring_model": model_id,
            "concept": "concept",
            "scale_size": scale_size,
            "scoring_method": "subset",
            "abstain_enabled": abstain_enabled,
            "evidence_view": evidence_view,
            "evidence_bundle_size": evidence_bundle_size,
            "bundle_strategy": bundle_strategy,
            "randomizations": [],
        },
        "run": {
            "run_id": f"run_{experiment_tag}",
            "status": "completed",
            "created_at": 123,
            "target_count": 2,
            "completed_count": 2,
            "current_stage": "score_critic",
            "pause_after": None,
        },
        "counts": {"responses": 2, "rubrics": 2, "evidence": 2, "samples": 2},
    }


def _seed_snapshot(
    connection,
    *,
    experiment_tag: str,
    abstain_enabled: bool,
    model_id: str = "gpt-4.1",
    scale_size: int = 4,
    evidence_view: str = "l2_neutralized",
    evidence_bundle_size: int = 1,
    bundle_signatures: tuple[str, str] = ("bundle_a", "bundle_b"),
    bundle_strategy: str | None = None,
) -> None:
    snapshot_id = create_snapshot(
        connection,
        deployment_url="https://example.convex.cloud",
        manifest=_manifest(
            experiment_tag,
            abstain_enabled,
            model_id=model_id,
            scale_size=scale_size,
            evidence_view=evidence_view,
            evidence_bundle_size=evidence_bundle_size,
            bundle_strategy=bundle_strategy,
        ),
    )
    write_snapshot_dataset(
        connection,
        snapshot_id=snapshot_id,
        table="analysis_responses",
        rows=[
            {
                "response_id": f"{experiment_tag}_score_1",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_id": f"{experiment_tag}_sample_1",
                "sample_ordinal": 1,
                "score_target_id": f"{experiment_tag}_target_1",
                "score_critic_id": f"{experiment_tag}_critic_1",
                "rubric_id": f"{experiment_tag}_rubric_1",
                "rubric_critic_id": f"{experiment_tag}_rubric_critic_1",
                "model": model_id,
                "concept": "concept",
                "scale_size": scale_size,
                "scoring_method": "subset",
                "abstain_enabled": abstain_enabled,
                "evidence_view": evidence_view,
                "evidence_bundle_size": evidence_bundle_size,
                "bundle_signature": bundle_signatures[0],
                "bundle_label": bundle_signatures[0],
                "bundle_size": evidence_bundle_size,
                "cluster_id": bundle_signatures[0],
                "randomizations": [],
                "decoded_scores": [2] if not abstain_enabled else [],
                "abstained": abstain_enabled,
                "subset_size": 1 if not abstain_enabled else 0,
                "justification": "ok",
                "score_expert_agreement_prob": 0.7,
                "rubric_observability_score": 0.8,
                "rubric_discriminability_score": 0.9,
                "evidence_ids": ["ev_1"],
                "evidence_labels": ["E1"],
                "evidence_titles": ["A"],
                "evidence_urls": ["https://a"],
                "window_ids": ["w_1"],
                "evidence_positions": [0],
            },
            {
                "response_id": f"{experiment_tag}_score_2",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_id": f"{experiment_tag}_sample_2",
                "sample_ordinal": 2,
                "score_target_id": f"{experiment_tag}_target_2",
                "score_critic_id": f"{experiment_tag}_critic_2",
                "rubric_id": f"{experiment_tag}_rubric_2",
                "rubric_critic_id": f"{experiment_tag}_rubric_critic_2",
                "model": model_id,
                "concept": "concept",
                "scale_size": scale_size,
                "scoring_method": "subset",
                "abstain_enabled": abstain_enabled,
                "evidence_view": evidence_view,
                "evidence_bundle_size": evidence_bundle_size,
                "bundle_signature": bundle_signatures[1],
                "bundle_label": bundle_signatures[1],
                "bundle_size": evidence_bundle_size,
                "cluster_id": bundle_signatures[1],
                "randomizations": [],
                "decoded_scores": [3],
                "abstained": False,
                "subset_size": 1,
                "justification": "ok",
                "score_expert_agreement_prob": 0.8,
                "rubric_observability_score": 0.85,
                "rubric_discriminability_score": 0.95,
                "evidence_ids": ["ev_2"],
                "evidence_labels": ["E2"],
                "evidence_titles": ["B"],
                "evidence_urls": ["https://b"],
                "window_ids": ["w_2"],
                "evidence_positions": [0],
            },
        ],
    )
    write_snapshot_dataset(
        connection,
        snapshot_id=snapshot_id,
        table="analysis_rubrics",
        rows=[
            {
                "rubric_id": f"{experiment_tag}_rubric_1",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_id": f"{experiment_tag}_sample_1",
                "sample_ordinal": 1,
                "model": model_id,
                "concept": "concept",
                "scale_size": scale_size,
                "stages": [
                    {"stage_number": 1, "label": "A", "criteria": ["a", "b", "c"]},
                    {"stage_number": 2, "label": "B", "criteria": ["a", "b", "c"]},
                    {"stage_number": 3, "label": "C", "criteria": ["a", "b", "c"]},
                    {"stage_number": 4, "label": "D", "criteria": ["a", "b", "c"]},
                ],
                "label_mapping": {"A": 1, "B": 2, "C": 3, "D": 4},
                "justification": "ok",
                "observability_score": 0.8,
                "discriminability_score": 0.9,
            },
            {
                "rubric_id": f"{experiment_tag}_rubric_2",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_id": f"{experiment_tag}_sample_2",
                "sample_ordinal": 2,
                "model": model_id,
                "concept": "concept",
                "scale_size": scale_size,
                "stages": [
                    {"stage_number": 1, "label": "A", "criteria": ["a", "b", "c"]},
                    {"stage_number": 2, "label": "B", "criteria": ["a", "b", "c"]},
                    {"stage_number": 3, "label": "C", "criteria": ["a", "b", "c"]},
                    {"stage_number": 4, "label": "D", "criteria": ["a", "b", "c"]},
                ],
                "label_mapping": {"A": 1, "B": 2, "C": 3, "D": 4},
                "justification": "ok",
                "observability_score": 0.85,
                "discriminability_score": 0.95,
            },
        ],
    )
    write_snapshot_dataset(
        connection,
        snapshot_id=snapshot_id,
        table="analysis_evidence",
        rows=[
            {
                "evidence_id": "ev_1",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "pool_tag": "pool-tag",
                "label": "E1",
                "title": "A",
                "url": "https://a",
                "window_id": "w_1",
            },
            {
                "evidence_id": "ev_2",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "pool_tag": "pool-tag",
                "label": "E2",
                "title": "B",
                "url": "https://b",
                "window_id": "w_2",
            },
        ],
    )
    write_snapshot_dataset(
        connection,
        snapshot_id=snapshot_id,
        table="analysis_samples",
        rows=[
            {
                "sample_id": f"{experiment_tag}_sample_1",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_ordinal": 1,
                "model": model_id,
                "seed": 1,
                "rubric_id": f"{experiment_tag}_rubric_1",
                "rubric_critic_id": f"{experiment_tag}_rubric_critic_1",
                "score_target_total": 1,
                "score_count": 1,
                "score_critic_count": 1,
            },
            {
                "sample_id": f"{experiment_tag}_sample_2",
                "experiment_id": f"exp_{experiment_tag}",
                "experiment_tag": experiment_tag,
                "run_id": f"run_{experiment_tag}",
                "sample_ordinal": 2,
                "model": model_id,
                "seed": 2,
                "rubric_id": f"{experiment_tag}_rubric_2",
                "rubric_critic_id": f"{experiment_tag}_rubric_critic_2",
                "score_target_total": 1,
                "score_count": 1,
                "score_critic_count": 1,
            },
        ],
    )
    mark_snapshot_completed(connection, snapshot_id)


class InvestigationReportTest(unittest.TestCase):
    def test_generate_v3_investigation_writes_tables_and_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                tags = [
                    ("v3_a1_gpt_4_1_abstain_false", False),
                    ("v3_a1_gpt_4_1_abstain_true", True),
                ]
                for experiment_tag, abstain_enabled in tags:
                    _seed_snapshot(
                        connection,
                        experiment_tag=experiment_tag,
                        abstain_enabled=abstain_enabled,
                    )
            finally:
                connection.close()

            output_dir = Path(tmpdir) / "investigation"
            report_dir = generate_v3_investigation(
                experiment_tags=[tag for tag, _ in tags],
                cache_db_path=str(db_path),
                output_dir=output_dir,
                rubric_embedding_encoder=lambda texts: np.array(
                    [
                        [
                            float(len(text)),
                            float(sum(ord(char) for char in text) % 97),
                            float(text.count("Stage")),
                        ]
                        for text in texts
                    ],
                    dtype=float,
                ),
            )
            self.assertTrue((report_dir / "report.md").exists())
            self.assertTrue((report_dir / "tables" / "family_effects.csv").exists())
            self.assertTrue((report_dir / "tables" / "candidate_findings.csv").exists())
            self.assertTrue((report_dir / "tables" / "experiment_geometry.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_experiment_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_focus_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_focus_clusters.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_contrast_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_stage_contrast_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "scale_certainty_effects.csv").exists())
            self.assertTrue((report_dir / "figures" / "family_effect_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "experiment_adjudicative_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "rubric_similarity_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "rubric_focus_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "rubric_stage_similarity_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "sample_expected_stage_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "sample_abstain_heatmap.png").exists())

            matching = pd.read_csv(report_dir / "tables" / "matching_validation.csv")
            self.assertEqual(len(matching), 1)
            self.assertTrue(bool(matching.iloc[0]["fully_matched"]))

    def test_generate_v3_investigation_adds_v3_1_followup_contrasts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c1_gpt_4_1_bundle_5_random_l2",
                    abstain_enabled=True,
                    model_id="gpt-4.1",
                    evidence_bundle_size=5,
                    bundle_signatures=("random_a", "random_b"),
                    bundle_strategy="random_bundle_5",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
                    abstain_enabled=True,
                    model_id="gpt-4.1",
                    evidence_bundle_size=5,
                    bundle_signatures=("cluster_a", "cluster_b"),
                    bundle_strategy="semantic_cluster_5",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2",
                    abstain_enabled=True,
                    model_id="gpt-4.1",
                    evidence_view="l3_abstracted",
                    evidence_bundle_size=5,
                    bundle_signatures=("cluster_a", "cluster_b"),
                    bundle_strategy="semantic_cluster_5_projected",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7",
                    abstain_enabled=True,
                    model_id="gpt-4.1",
                    scale_size=7,
                    evidence_bundle_size=5,
                    bundle_signatures=("cluster_a", "cluster_b"),
                    bundle_strategy="semantic_cluster_5",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9",
                    abstain_enabled=True,
                    model_id="gpt-4.1",
                    scale_size=9,
                    evidence_bundle_size=5,
                    bundle_signatures=("cluster_a", "cluster_b"),
                    bundle_strategy="semantic_cluster_5",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_b1_gpt_4_1_mini_abstain_true",
                    abstain_enabled=True,
                    model_id="gpt-4.1-mini",
                )
                _seed_snapshot(
                    connection,
                    experiment_tag="v3_1_c4_gpt_4_1_mini_scale_5",
                    abstain_enabled=True,
                    model_id="gpt-4.1-mini",
                    scale_size=5,
                )
            finally:
                connection.close()

            report_dir = generate_v3_investigation(
                experiment_tags=[
                    "v3_1_c1_gpt_4_1_bundle_5_random_l2",
                    "v3_1_c2_gpt_4_1_bundle_5_cluster_l2_v2",
                    "v3_1_c3_gpt_4_1_bundle_5_cluster_l3_v2",
                    "v3_1_c6_gpt_4_1_bundle_5_cluster_l2_scale_7",
                    "v3_1_c7_gpt_4_1_bundle_5_cluster_l2_scale_9",
                    "v3_b1_gpt_4_1_mini_abstain_true",
                    "v3_1_c4_gpt_4_1_mini_scale_5",
                ],
                cache_db_path=str(db_path),
                output_dir=Path(tmpdir) / "investigation",
                rubric_embedding_encoder=lambda texts: np.array(
                    [
                        [
                            float(len(text)),
                            float(sum(ord(char) for char in text) % 97),
                            float(text.count("Stage")),
                        ]
                        for text in texts
                    ],
                    dtype=float,
                ),
            )

            matching = pd.read_csv(report_dir / "tables" / "matching_validation.csv")
            scale_matching = pd.read_csv(report_dir / "tables" / "scale_matching_validation.csv")

            bundle_strategy = matching[matching["contrast_id"].str.contains("c1_bundle_strategy", regex=False)]
            self.assertEqual(len(bundle_strategy), 1)
            self.assertTrue(bool(bundle_strategy.iloc[0]["fully_matched"]))
            self.assertIn("window/bundle-size", str(bundle_strategy.iloc[0]["notes"]))

            projected_l3 = matching[matching["contrast_id"].str.contains("c2_l3_projection", regex=False)]
            self.assertEqual(len(projected_l3), 1)
            self.assertTrue(bool(projected_l3.iloc[0]["fully_matched"]))

            scale_probe = matching[matching["contrast_id"].str.contains("c6_scale_probe", regex=False)]
            self.assertEqual(len(scale_probe), 1)
            self.assertTrue(bool(scale_probe.iloc[0]["fully_matched"]))

            self.assertTrue((scale_matching["contrast_id"].str.contains("v3_b1_gpt_4_1_mini_abstain_true__vs__v3_1_c4_gpt_4_1_mini_scale_5", regex=False)).any())
            self.assertTrue(
                (
                    report_dir
                    / "figures"
                    / "rubric_focus_heatmap.png"
                ).exists()
            )
            self.assertTrue(
                (
                    report_dir
                    / "figures"
                    / "family_verdict_heatmaps"
                    / "c7_bundle_5_cluster_l2_scale_9_verdict_distribution_geometry_bucketed.png"
                ).exists()
            )


if __name__ == "__main__":
    unittest.main()
