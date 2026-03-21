from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from judge_gym.analysis_contract import ContractValidationError
from judge_gym.cache import (
    connect_cache,
    create_snapshot,
    mark_snapshot_completed,
    write_snapshot_dataset,
)
from judge_gym.datasets import load_snapshot_bundle_for_contract


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


def _manifest(*, experiment_tag: str, export_schema_version: int = 3) -> dict[str, object]:
    return {
        "export_schema_version": export_schema_version,
        "experiment": {
            "experiment_id": f"{experiment_tag}_id",
            "experiment_tag": experiment_tag,
            "pool_id": "pool_1",
            "pool_tag": "pool_tag",
            "evidence_count": 1,
            "model_id": "gpt-4.1",
            "rubric_model": "gpt-4.1",
            "scoring_model": "gpt-4.1",
            "concept": "concept",
            "scale_size": 4,
            "scoring_method": "subset",
            "abstain_enabled": True,
            "evidence_view": "l2_neutralized",
            "evidence_bundle_size": 1,
            "randomizations": [],
        },
        "run": {
            "run_id": f"{experiment_tag}_run",
            "status": "completed",
            "created_at": 123,
            "target_count": 30,
            "completed_count": 30,
            "current_stage": "score_critic",
            "pause_after": None,
        },
        "counts": {"responses": 1, "rubrics": 0, "evidence": 0, "samples": 0},
    }


class ContractDatasetsTest(unittest.TestCase):
    def test_load_snapshot_bundle_for_contract_filters_frozen_slice(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            db_path = root / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                snapshot_id = create_snapshot(
                    connection,
                    deployment_url="https://example.convex.cloud",
                    manifest=_manifest(experiment_tag="v3_demo"),
                )
                write_snapshot_dataset(
                    connection,
                    snapshot_id=snapshot_id,
                    table="analysis_responses",
                    rows=[
                        {
                            "response_id": "resp_1",
                            "experiment_id": "exp_1",
                            "experiment_tag": "v3_demo",
                            "run_id": "run_1",
                            "sample_id": "sample_1",
                            "sample_ordinal": 1,
                            "score_target_id": "target_1",
                            "score_critic_id": "critic_1",
                            "rubric_id": "rubric_1",
                            "rubric_critic_id": "rubric_critic_1",
                            "model": "gpt-4.1",
                            "concept": "concept",
                            "scale_size": 4,
                            "scoring_method": "subset",
                            "abstain_enabled": True,
                            "evidence_view": "l2_neutralized",
                            "evidence_bundle_size": 1,
                            "bundle_plan_tag": "plan_1",
                            "bundle_strategy": "window_round_robin",
                            "bundle_strategy_version": "v1",
                            "clustering_seed": None,
                            "bundle_signature": "ev_1",
                            "cluster_id": None,
                            "randomizations": [],
                            "decoded_scores": [2],
                            "abstained": False,
                            "subset_size": 1,
                            "justification": "ok",
                            "score_expert_agreement_prob": 0.8,
                            "rubric_observability_score": 0.7,
                            "rubric_discriminability_score": 0.6,
                            "evidence_ids": ["ev_1"],
                            "evidence_labels": ["E1"],
                            "evidence_titles": ["Title"],
                            "evidence_urls": ["https://example.com"],
                            "window_ids": ["w1"],
                            "evidence_positions": [0],
                        }
                    ],
                )
                mark_snapshot_completed(connection, snapshot_id)
            finally:
                connection.close()

            contract_path = root / "analysis_contract.json"
            contract_payload: dict[str, object] = {
                "contractVersion": 1,
                "createdAt": "2026-03-19",
                "purpose": "test",
                "dataSource": {
                    "sqlitePath": str(db_path),
                    "exportSchemaVersion": 3,
                    "snapshotIds": [snapshot_id],
                    "selectionPolicy": {
                        "includeTagPrefixes": ["v3_"],
                        "runSelector": "latest_completed",
                    },
                },
                "inclusion": {
                    "includeTags": ["v3_demo"],
                    "excludeTags": ["v3_bad"],
                    "excludeRationale": "n/a",
                },
                "analysisUnit": {
                    "primaryKey": ["experiment_tag", "sample_ordinal"],
                    "secondaryKey": ["bundle_signature"],
                    "notes": "",
                },
                "contrastRegistry": {
                    "path": "unused_in_test.json",
                    "version": "v1",
                    "contrastCount": 1,
                    "notes": "",
                },
            }
            _write_json(contract_path, contract_payload)

            contrast_path = root / "v3_contrasts.json"
            _write_json(
                contrast_path,
                {
                    "registryVersion": "v1",
                    "contrasts": [
                        {
                            "contrastId": "demo:v3_demo__vs__v3_demo",
                            "familySlug": "demo",
                            "contrastKind": "self",
                            "baselineTag": "v3_demo",
                            "variantTag": "v3_demo",
                            "matchingKeys": ["sample_ordinal"],
                            "mode": "inferential",
                            "fullyMatched": True,
                        }
                    ],
                },
            )
            figures_manifest_path = root / "figures_manifest.json"
            _write_json(
                figures_manifest_path,
                {
                    "manifestVersion": 1,
                    "contractRef": {"contractHash": hashlib.sha256(contract_path.read_bytes()).hexdigest()},
                    "figures": [],
                },
            )

            loaded = load_snapshot_bundle_for_contract(
                contract_path=str(contract_path),
                contrast_registry_path=str(contrast_path),
                figures_manifest_path=str(figures_manifest_path),
                cache_db_path=str(db_path),
            )

            self.assertEqual(loaded.contract.snapshot_ids, [snapshot_id])
            self.assertEqual(loaded.bundle.snapshot_ids, [snapshot_id])
            self.assertEqual(loaded.bundle.experiment_tags, ["v3_demo"])
            self.assertEqual(len(loaded.bundle.responses), 1)

    def test_load_snapshot_bundle_for_contract_detects_snapshot_drift(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            db_path = root / "cache.sqlite"
            connection = connect_cache(db_path)
            connection.close()

            contract_path = root / "analysis_contract.json"
            _write_json(
                contract_path,
                {
                    "contractVersion": 1,
                    "createdAt": "2026-03-19",
                    "purpose": "test",
                    "dataSource": {
                        "sqlitePath": str(db_path),
                        "exportSchemaVersion": 3,
                        "snapshotIds": ["missing_snapshot"],
                        "selectionPolicy": {
                            "includeTagPrefixes": ["v3_"],
                            "runSelector": "latest_completed",
                        },
                    },
                    "inclusion": {
                        "includeTags": ["v3_demo"],
                        "excludeTags": [],
                        "excludeRationale": "n/a",
                    },
                    "analysisUnit": {
                        "primaryKey": ["experiment_tag", "sample_ordinal"],
                        "secondaryKey": ["bundle_signature"],
                        "notes": "",
                    },
                    "contrastRegistry": {
                        "path": "unused_in_test.json",
                        "version": "v1",
                        "contrastCount": 1,
                        "notes": "",
                    },
                },
            )
            contrast_path = root / "v3_contrasts.json"
            _write_json(
                contrast_path,
                {
                    "registryVersion": "v1",
                    "contrasts": [
                        {
                            "contrastId": "demo:v3_demo__vs__v3_demo",
                            "familySlug": "demo",
                            "contrastKind": "self",
                            "baselineTag": "v3_demo",
                            "variantTag": "v3_demo",
                            "matchingKeys": ["sample_ordinal"],
                            "mode": "inferential",
                            "fullyMatched": True,
                        }
                    ],
                },
            )
            figures_manifest_path = root / "figures_manifest.json"
            _write_json(
                figures_manifest_path,
                {
                    "manifestVersion": 1,
                    "contractRef": {"contractHash": hashlib.sha256(contract_path.read_bytes()).hexdigest()},
                    "figures": [],
                },
            )

            with self.assertRaises(ContractValidationError):
                load_snapshot_bundle_for_contract(
                    contract_path=str(contract_path),
                    contrast_registry_path=str(contrast_path),
                    figures_manifest_path=str(figures_manifest_path),
                    cache_db_path=str(db_path),
                )


if __name__ == "__main__":
    unittest.main()

