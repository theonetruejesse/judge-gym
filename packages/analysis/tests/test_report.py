from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from judge_gym.cache import connect_cache, create_snapshot, mark_snapshot_completed, write_snapshot_dataset
from judge_gym.report_pilot import generate_pilot_report, generate_v3_report_suite


class PilotReportTest(unittest.TestCase):
    def test_generate_pilot_report_writes_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                manifest = {
                    "export_schema_version": 1,
                    "experiment": {
                        "experiment_id": "exp_1",
                        "experiment_tag": "exp-tag",
                        "pool_id": "pool_1",
                        "pool_tag": "pool-tag",
                        "evidence_count": 2,
                        "model_id": "gpt-4.1-mini",
                        "rubric_model": "gpt-4.1-mini",
                        "scoring_model": "gpt-4.1-mini",
                        "concept": "concept",
                        "scale_size": 4,
                        "scoring_method": "subset",
                        "abstain_enabled": True,
                        "evidence_view": "l0_raw",
                        "evidence_bundle_size": 1,
                        "randomizations": [],
                    },
                    "run": {
                        "run_id": "run_1",
                        "status": "completed",
                        "created_at": 123,
                        "target_count": 2,
                        "completed_count": 2,
                        "current_stage": "score_critic",
                        "pause_after": None,
                    },
                    "counts": {"responses": 2, "rubrics": 2, "evidence": 2, "samples": 2},
                }
                snapshot_id = create_snapshot(
                    connection,
                    deployment_url="https://example.convex.cloud",
                    manifest=manifest,
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table="analysis_responses",
                    rows=[
                        {
                            "response_id": "score_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_id": "sample_1",
                            "sample_ordinal": 1,
                            "score_target_id": "target_1",
                            "score_critic_id": "critic_1",
                            "rubric_id": "rubric_1",
                            "rubric_critic_id": "rubric_critic_1",
                            "model": "gpt-4.1-mini",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l0_raw",
                            "evidence_bundle_size": 1,
                            "randomizations": [],
                            "decoded_scores": [2],
                            "abstained": False,
                            "subset_size": 1,
                            "justification": "ok",
                            "score_expert_agreement_prob": 0.8,
                            "rubric_observability_score": 0.9,
                            "rubric_discriminability_score": 0.7,
                            "evidence_ids": ["ev_1"],
                            "evidence_labels": ["E1"],
                            "evidence_titles": ["A"],
                            "evidence_urls": ["https://a"],
                            "window_ids": ["w_1"],
                            "evidence_positions": [0],
                        },
                        {
                            "response_id": "score_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_id": "sample_2",
                            "sample_ordinal": 2,
                            "score_target_id": "target_2",
                            "score_critic_id": "critic_2",
                            "rubric_id": "rubric_2",
                            "rubric_critic_id": "rubric_critic_2",
                            "model": "gpt-4.1-mini",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l0_raw",
                            "evidence_bundle_size": 1,
                            "randomizations": [],
                            "decoded_scores": [],
                            "abstained": True,
                            "subset_size": 0,
                            "justification": "ok",
                            "score_expert_agreement_prob": 0.7,
                            "rubric_observability_score": 0.8,
                            "rubric_discriminability_score": 0.6,
                            "evidence_ids": ["ev_2"],
                            "evidence_labels": ["E2"],
                            "evidence_titles": ["B"],
                            "evidence_urls": ["https://b"],
                            "window_ids": ["w_1"],
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
                            "rubric_id": "rubric_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_id": "sample_1",
                            "sample_ordinal": 1,
                            "model": "gpt-4.1-mini",
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
                            "observability_score": 0.9,
                            "discriminability_score": 0.7,
                        },
                        {
                            "rubric_id": "rubric_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_id": "sample_2",
                            "sample_ordinal": 2,
                            "model": "gpt-4.1-mini",
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
                            "discriminability_score": 0.6,
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
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "pool_tag": "pool-tag",
                            "label": "E1",
                            "title": "A",
                            "url": "https://a",
                            "window_id": "w_1",
                        },
                        {
                            "evidence_id": "ev_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "pool_tag": "pool-tag",
                            "label": "E2",
                            "title": "B",
                            "url": "https://b",
                            "window_id": "w_1",
                        },
                    ],
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table="analysis_samples",
                    rows=[
                        {
                            "sample_id": "sample_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_ordinal": 1,
                            "model": "gpt-4.1-mini",
                            "seed": 1,
                            "rubric_id": "rubric_1",
                            "rubric_critic_id": "rubric_critic_1",
                            "score_target_total": 1,
                            "score_count": 1,
                            "score_critic_count": 1,
                        },
                        {
                            "sample_id": "sample_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "run_id": "run_1",
                            "sample_ordinal": 2,
                            "model": "gpt-4.1-mini",
                            "seed": 2,
                            "rubric_id": "rubric_2",
                            "rubric_critic_id": "rubric_critic_2",
                            "score_target_total": 1,
                            "score_count": 1,
                            "score_critic_count": 1,
                        },
                    ],
                )
                mark_snapshot_completed(connection, snapshot_id)
            finally:
                connection.close()

            output_dir = Path(tmpdir) / "report"
            report_dir = generate_pilot_report(
                snapshot_ids=[snapshot_id],
                cache_db_path=str(db_path),
                output_dir=output_dir,
            )
            self.assertTrue((report_dir / "summary.json").exists())
            self.assertTrue((report_dir / "tables" / "evidence.csv").exists())
            self.assertTrue((report_dir / "figures" / "subset_stage_counts.png").exists())
            self.assertTrue((report_dir / "tables" / "pairwise_divergence.csv").exists())

    def test_generate_v3_report_suite_splits_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "cache.sqlite"
            connection = connect_cache(db_path)
            experiment_tag = "v3_a1_demo"
            try:
                manifest = {
                    "export_schema_version": 1,
                    "experiment": {
                        "experiment_id": "exp_1",
                        "experiment_tag": experiment_tag,
                        "pool_id": "pool_1",
                        "pool_tag": "pool-tag",
                        "evidence_count": 2,
                        "model_id": "gpt-4.1-mini",
                        "rubric_model": "gpt-4.1-mini",
                        "scoring_model": "gpt-4.1-mini",
                        "concept": "concept",
                        "scale_size": 4,
                        "scoring_method": "subset",
                        "abstain_enabled": True,
                        "evidence_view": "l0_raw",
                        "evidence_bundle_size": 1,
                        "randomizations": [],
                    },
                    "run": {
                        "run_id": "run_1",
                        "status": "completed",
                        "created_at": 123,
                        "target_count": 2,
                        "completed_count": 2,
                        "current_stage": "score_critic",
                        "pause_after": None,
                    },
                    "counts": {"responses": 2, "rubrics": 2, "evidence": 2, "samples": 2},
                }
                snapshot_id = create_snapshot(
                    connection,
                    deployment_url="https://example.convex.cloud",
                    manifest=manifest,
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table="analysis_responses",
                    rows=[
                        {
                            "response_id": "score_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_id": "sample_1",
                            "sample_ordinal": 1,
                            "score_target_id": "target_1",
                            "score_critic_id": "critic_1",
                            "rubric_id": "rubric_1",
                            "rubric_critic_id": "rubric_critic_1",
                            "model": "gpt-4.1-mini",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l0_raw",
                            "evidence_bundle_size": 1,
                            "randomizations": [],
                            "decoded_scores": [2],
                            "abstained": False,
                            "subset_size": 1,
                            "justification": "ok",
                            "score_expert_agreement_prob": 0.8,
                            "rubric_observability_score": 0.9,
                            "rubric_discriminability_score": 0.7,
                            "evidence_ids": ["ev_1"],
                            "evidence_labels": ["E1"],
                            "evidence_titles": ["A"],
                            "evidence_urls": ["https://a"],
                            "window_ids": ["w_1"],
                            "evidence_positions": [0],
                        },
                        {
                            "response_id": "score_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_id": "sample_2",
                            "sample_ordinal": 2,
                            "score_target_id": "target_2",
                            "score_critic_id": "critic_2",
                            "rubric_id": "rubric_2",
                            "rubric_critic_id": "rubric_critic_2",
                            "model": "gpt-4.1-mini",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l0_raw",
                            "evidence_bundle_size": 1,
                            "randomizations": [],
                            "decoded_scores": [],
                            "abstained": True,
                            "subset_size": 0,
                            "justification": "ok",
                            "score_expert_agreement_prob": 0.7,
                            "rubric_observability_score": 0.8,
                            "rubric_discriminability_score": 0.6,
                            "evidence_ids": ["ev_2"],
                            "evidence_labels": ["E2"],
                            "evidence_titles": ["B"],
                            "evidence_urls": ["https://b"],
                            "window_ids": ["w_1"],
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
                            "rubric_id": "rubric_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_id": "sample_1",
                            "sample_ordinal": 1,
                            "model": "gpt-4.1-mini",
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
                            "observability_score": 0.9,
                            "discriminability_score": 0.7,
                        },
                        {
                            "rubric_id": "rubric_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_id": "sample_2",
                            "sample_ordinal": 2,
                            "model": "gpt-4.1-mini",
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
                            "discriminability_score": 0.6,
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
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "pool_tag": "pool-tag",
                            "label": "E1",
                            "title": "A",
                            "url": "https://a",
                            "window_id": "w_1",
                        },
                        {
                            "evidence_id": "ev_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "pool_tag": "pool-tag",
                            "label": "E2",
                            "title": "B",
                            "url": "https://b",
                            "window_id": "w_1",
                        },
                    ],
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table="analysis_samples",
                    rows=[
                        {
                            "sample_id": "sample_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_ordinal": 1,
                            "model": "gpt-4.1-mini",
                            "seed": 1,
                            "rubric_id": "rubric_1",
                            "rubric_critic_id": "rubric_critic_1",
                            "score_target_total": 1,
                            "score_count": 1,
                            "score_critic_count": 1,
                        },
                        {
                            "sample_id": "sample_2",
                            "experiment_id": "exp_1",
                            "experiment_tag": experiment_tag,
                            "run_id": "run_1",
                            "sample_ordinal": 2,
                            "model": "gpt-4.1-mini",
                            "seed": 2,
                            "rubric_id": "rubric_2",
                            "rubric_critic_id": "rubric_critic_2",
                            "score_target_total": 1,
                            "score_count": 1,
                            "score_critic_count": 1,
                        },
                    ],
                )
                mark_snapshot_completed(connection, snapshot_id)
            finally:
                connection.close()

            output_dir = Path(tmpdir) / "suite"
            report_dir = generate_v3_report_suite(
                snapshot_ids=[snapshot_id],
                cache_db_path=str(db_path),
                output_dir=output_dir,
            )
            self.assertTrue((report_dir / "overview" / "summary.json").exists())
            self.assertTrue((report_dir / "overview" / "tables" / "experiment_metrics.csv").exists())
            self.assertTrue((report_dir / "experiments" / experiment_tag / "summary.json").exists())
            self.assertTrue((report_dir / "families" / "a1_abstain_toggle" / "summary.json").exists())


if __name__ == "__main__":
    unittest.main()
