from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from judge_gym.cache import connect_cache, create_snapshot, mark_snapshot_completed, write_snapshot_dataset
from judge_gym.investigate_v3 import generate_v3_investigation


def _manifest(experiment_tag: str, abstain_enabled: bool) -> dict:
    return {
        "export_schema_version": 1,
        "experiment": {
            "experiment_id": f"exp_{experiment_tag}",
            "experiment_tag": experiment_tag,
            "pool_id": "pool_1",
            "pool_tag": "pool-tag",
            "evidence_count": 2,
            "model_id": "gpt-4.1",
            "rubric_model": "gpt-4.1",
            "scoring_model": "gpt-4.1",
            "concept": "concept",
            "scale_size": 4,
            "scoring_method": "subset",
            "abstain_enabled": abstain_enabled,
            "evidence_view": "l2_neutralized",
            "evidence_bundle_size": 1,
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
                    snapshot_id = create_snapshot(
                        connection,
                        deployment_url="https://example.convex.cloud",
                        manifest=_manifest(experiment_tag, abstain_enabled),
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
                                "model": "gpt-4.1",
                                "concept": "concept",
                                "scale_size": 4,
                                "scoring_method": "subset",
                                "abstain_enabled": abstain_enabled,
                                "evidence_view": "l2_neutralized",
                                "evidence_bundle_size": 1,
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
                                "model": "gpt-4.1",
                                "concept": "concept",
                                "scale_size": 4,
                                "scoring_method": "subset",
                                "abstain_enabled": abstain_enabled,
                                "evidence_view": "l2_neutralized",
                                "evidence_bundle_size": 1,
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
                                "model": "gpt-4.1",
                                "concept": "concept",
                                "scale_size": 4,
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
                                "model": "gpt-4.1",
                                "concept": "concept",
                                "scale_size": 4,
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
                                "model": "gpt-4.1",
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
                                "model": "gpt-4.1",
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
            self.assertTrue((report_dir / "tables" / "rubric_contrast_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "rubric_stage_contrast_similarity.csv").exists())
            self.assertTrue((report_dir / "tables" / "scale_certainty_effects.csv").exists())
            self.assertTrue((report_dir / "figures" / "family_effect_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "experiment_adjudicative_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "rubric_similarity_heatmap.png").exists())
            self.assertTrue((report_dir / "figures" / "rubric_stage_similarity_heatmap.png").exists())

            matching = pd.read_csv(report_dir / "tables" / "matching_validation.csv")
            self.assertEqual(len(matching), 1)
            self.assertTrue(bool(matching.iloc[0]["fully_matched"]))


if __name__ == "__main__":
    unittest.main()
