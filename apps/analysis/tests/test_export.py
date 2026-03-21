from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

import httpx

from judge_gym.cache import connect_cache
from judge_gym.datasets import load_snapshot_bundle
from judge_gym.export import export_experiments


def build_transport() -> httpx.MockTransport:
    calls: dict[str, int] = {
        "apps/analysis:listAnalysisResponses": 0,
        "apps/analysis:listAnalysisRubrics": 0,
        "apps/analysis:listAnalysisEvidence": 0,
        "apps/analysis:listAnalysisSamples": 0,
    }

    def handler(request: httpx.Request) -> httpx.Response:
        payload = request.read().decode()
        body = httpx.Request(
            method="POST",
            url="https://example.com",
            content=payload,
        )
        data = __import__("json").loads(body.content.decode())
        path = data["path"]
        args = data["args"]

        if path == "apps/analysis:getAnalysisManifest":
            return httpx.Response(
                200,
                json={
                    "value": {
                        "export_schema_version": 3,
                        "experiment": {
                            "experiment_id": "exp_1",
                            "experiment_tag": "exp-tag",
                            "pool_id": "pool_1",
                            "pool_tag": "pool-tag",
                            "bundle_plan_id": None,
                            "bundle_plan_tag": "plan-tag",
                            "bundle_strategy": "semantic_cluster",
                            "bundle_strategy_version": "v2",
                            "clustering_seed": 7,
                            "bundle_source_view": "l2_neutralized",
                            "evidence_count": 2,
                            "model_id": "gpt-4.1-mini",
                            "rubric_model": "gpt-4.1-mini",
                            "scoring_model": "gpt-4.1-mini",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l0_raw",
                            "evidence_bundle_size": 2,
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
                        "counts": {
                            "responses": 2,
                            "rubrics": 2,
                            "evidence": 2,
                            "samples": 2,
                        },
                    }
                },
            )

        if path.startswith("apps/analysis:listAnalysis"):
            calls[path] += 1
            cursor = ((args.get("pagination") or {}).get("cursor"))
            if path == "apps/analysis:listAnalysisResponses":
                page = [{
                    "response_id": "score_1" if cursor is None else "score_2",
                    "experiment_id": "exp_1",
                    "experiment_tag": "exp-tag",
                    "run_id": "run_1",
                    "sample_id": "sample_1" if cursor is None else "sample_2",
                    "sample_ordinal": 1 if cursor is None else 2,
                    "score_target_id": "target_1" if cursor is None else "target_2",
                    "score_critic_id": "critic_1" if cursor is None else "critic_2",
                    "rubric_id": "rubric_1" if cursor is None else "rubric_2",
                    "rubric_critic_id": "rubric_critic_1" if cursor is None else "rubric_critic_2",
                    "model": "gpt-4.1-mini",
                    "concept": "concept",
                    "scale_size": 4,
                    "scoring_method": "subset",
                    "abstain_enabled": True,
                    "evidence_view": "l0_raw",
                    "evidence_bundle_size": 2,
                    "bundle_plan_tag": "plan-tag",
                    "bundle_strategy": "semantic_cluster",
                    "bundle_strategy_version": "v2",
                    "clustering_seed": 7,
                    "bundle_signature": "ev_1|ev_2",
                    "cluster_id": "cluster_1",
                    "randomizations": [],
                    "decoded_scores": [2, 3] if cursor is None else [],
                    "abstained": cursor is not None,
                    "subset_size": 2 if cursor is None else 0,
                    "justification": "ok",
                    "score_expert_agreement_prob": 0.7,
                    "rubric_observability_score": 0.8,
                    "rubric_discriminability_score": 0.9,
                    "evidence_ids": ["ev_1", "ev_2"],
                    "evidence_labels": ["E1", "E2"],
                    "evidence_titles": ["A", "B"],
                    "evidence_urls": ["https://a", "https://b"],
                    "window_ids": ["w_1", "w_1"],
                    "evidence_positions": [0, 1],
                }]
                return httpx.Response(
                    200,
                    json={"value": {
                        "page": page,
                        "continue_cursor": None if cursor == "1" else "1",
                        "is_done": cursor == "1",
                        "total_count": 2,
                    }},
                )

            dataset_map = {
                "apps/analysis:listAnalysisRubrics": {
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
                    ],
                    "label_mapping": {"A": 1, "B": 2},
                    "justification": "ok",
                    "observability_score": 0.8,
                    "discriminability_score": 0.9,
                },
                "apps/analysis:listAnalysisEvidence": {
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
                "apps/analysis:listAnalysisSamples": {
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
            }
            row = dataset_map[path]
            return httpx.Response(
                200,
                json={"value": {
                    "page": [row],
                    "continue_cursor": None,
                    "is_done": True,
                    "total_count": 1,
                }},
            )

        raise AssertionError(path)

    return httpx.MockTransport(handler)


class ExportPipelineTest(unittest.TestCase):
    def test_export_experiments_writes_cache_and_decodes_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "cache.sqlite"
            snapshots = export_experiments(
                experiment_tags=["exp-tag"],
                deployment_url="https://example.convex.cloud",
                cache_db_path=str(db_path),
                page_size=1,
                transport=build_transport(),
            )
            self.assertEqual(len(snapshots), 1)

            bundle = load_snapshot_bundle(
                experiment_tags=["exp-tag"],
                cache_db_path=str(db_path),
            )
            self.assertEqual(len(bundle.responses), 2)
            self.assertEqual(bundle.responses.iloc[0]["bundle_label"], "E1 | E2")
            self.assertEqual(bundle.responses.iloc[1]["abstained"], True)
            self.assertEqual(bundle.responses.iloc[0]["bundle_signature"], "ev_1|ev_2")
            self.assertEqual(bundle.responses.iloc[0]["cluster_id"], "cluster_1")
            self.assertEqual(len(bundle.rubrics), 1)
            self.assertEqual(len(bundle.evidence), 1)
            self.assertEqual(len(bundle.samples), 1)
            self.assertEqual(len(bundle.response_items), 4)
            self.assertEqual(bundle.response_items.iloc[0]["bundle_plan_tag"], "plan-tag")

            connection = connect_cache(str(db_path))
            try:
                row = connection.execute(
                    "SELECT status FROM export_snapshots WHERE snapshot_id = ?",
                    (snapshots[0].snapshot_id,),
                ).fetchone()
                self.assertEqual(row["status"], "completed")
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()
