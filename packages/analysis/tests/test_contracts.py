from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from judge_gym.analysis_contract import (
    ContractValidationError,
    load_analysis_contract,
    load_contract_artifacts,
    validate_contract_against_cache,
)
from judge_gym.cache import connect_cache, create_snapshot, mark_snapshot_completed


def _manifest(*, experiment_tag: str, export_schema_version: int) -> dict[str, object]:
    return {
        "export_schema_version": export_schema_version,
        "experiment": {
            "experiment_id": f"{experiment_tag}_id",
            "experiment_tag": experiment_tag,
            "pool_id": "pool_1",
            "pool_tag": "pool_tag",
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
            "evidence_count": 1,
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
        "counts": {"responses": 0, "rubrics": 0, "evidence": 0, "samples": 0},
    }


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n")


class ContractArtifactsTest(unittest.TestCase):
    def test_load_and_validate_contract_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            db_path = root / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                snapshot_id = create_snapshot(
                    connection,
                    deployment_url="https://example.convex.cloud",
                    manifest=_manifest(experiment_tag="v3_demo", export_schema_version=3),
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
            contract_hash = hashlib.sha256(contract_path.read_bytes()).hexdigest()
            _write_json(
                figures_manifest_path,
                {
                    "manifestVersion": 1,
                    "contractRef": {
                        "contractPath": str(contract_path),
                        "contractHash": contract_hash,
                    },
                    "figures": [],
                },
            )

            artifacts = load_contract_artifacts(
                contract_path=contract_path,
                contrast_registry_path=contrast_path,
                figures_manifest_path=figures_manifest_path,
            )

            self.assertEqual(artifacts.contract.snapshot_ids, [snapshot_id])
            self.assertEqual(len(artifacts.contrast_registry.contrasts), 1)

            connection = connect_cache(db_path)
            try:
                validate_contract_against_cache(
                    connection,
                    artifacts.contract,
                    artifacts.contrast_registry,
                )
            finally:
                connection.close()

    def test_contract_overlap_raises_validation_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "analysis_contract.json"
            _write_json(
                path,
                {
                    "contractVersion": 1,
                    "createdAt": "2026-03-19",
                    "purpose": "test",
                    "dataSource": {
                        "sqlitePath": "cache.sqlite",
                        "exportSchemaVersion": 3,
                        "snapshotIds": ["s1"],
                        "selectionPolicy": {
                            "includeTagPrefixes": ["v3_"],
                            "runSelector": "latest_completed",
                        },
                    },
                    "inclusion": {
                        "includeTags": ["v3_a"],
                        "excludeTags": ["v3_a"],
                        "excludeRationale": "n/a",
                    },
                    "analysisUnit": {
                        "primaryKey": ["experiment_tag", "sample_ordinal"],
                        "secondaryKey": ["bundle_signature"],
                        "notes": "",
                    },
                    "contrastRegistry": {
                        "path": "x.json",
                        "version": "v1",
                        "contrastCount": 0,
                        "notes": "",
                    },
                },
            )
            with self.assertRaises(ContractValidationError):
                load_analysis_contract(path)

    def test_contrast_count_drift_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            contract_path = root / "analysis_contract.json"
            _write_json(
                contract_path,
                {
                    "contractVersion": 1,
                    "createdAt": "2026-03-19",
                    "purpose": "test",
                    "dataSource": {
                        "sqlitePath": "cache.sqlite",
                        "exportSchemaVersion": 3,
                        "snapshotIds": ["s1"],
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
                        "path": "x.json",
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
                    "contrasts": [],
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
                load_contract_artifacts(
                    contract_path=contract_path,
                    contrast_registry_path=contrast_path,
                    figures_manifest_path=figures_manifest_path,
                )

    def test_cache_schema_drift_raises(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            db_path = root / "cache.sqlite"
            connection = connect_cache(db_path)
            try:
                snapshot_id = create_snapshot(
                    connection,
                    deployment_url="https://example.convex.cloud",
                    manifest=_manifest(experiment_tag="v3_demo", export_schema_version=2),
                )
                mark_snapshot_completed(connection, snapshot_id)
            finally:
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
                        "snapshotIds": [snapshot_id],
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
                        "path": "x.json",
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

            artifacts = load_contract_artifacts(
                contract_path=contract_path,
                contrast_registry_path=contrast_path,
                figures_manifest_path=figures_manifest_path,
            )
            connection = connect_cache(db_path)
            try:
                with self.assertRaises(ContractValidationError):
                    validate_contract_against_cache(
                        connection,
                        artifacts.contract,
                        artifacts.contrast_registry,
                    )
            finally:
                connection.close()


if __name__ == "__main__":
    unittest.main()

