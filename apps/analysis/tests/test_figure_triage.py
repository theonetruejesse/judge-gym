from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from judge_gym.figure_layout import (
    bucket_verdict_label,
    bucket_verdict_labels,
    paginate_labels,
    parse_verdict_label,
    should_annotate_heatmap,
    suggest_facet_grid,
)
from judge_gym.figure_triage import (
    FigureManifestError,
    build_repair_plan,
    figures_by_readability,
    figures_by_tier,
    load_figure_manifest,
    select_figures,
)


REPO_ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = REPO_ROOT / "_blueprints" / "v3-analysis-process" / "figures_manifest.json"


class FigureManifestTests(unittest.TestCase):
    def test_load_manifest_and_groupings(self) -> None:
        manifest = load_figure_manifest(MANIFEST_PATH)
        self.assertEqual(manifest.manifest_version, 1)
        self.assertEqual(len(manifest.figures), 11)

        tier_groups = figures_by_tier(manifest)
        self.assertEqual(len(tier_groups["hero"]), 3)
        self.assertEqual(len(tier_groups["report"]), 3)
        self.assertEqual(len(tier_groups["appendix"]), 2)
        self.assertEqual(len(tier_groups["exploratory"]), 3)

        status_groups = figures_by_readability(manifest)
        self.assertEqual(len(status_groups["report_grade"]), 6)
        self.assertEqual(len(status_groups["borderline"]), 1)
        self.assertEqual(len(status_groups["appendix_grade"]), 1)
        self.assertEqual(len(status_groups["unreadable"]), 3)

        hero = select_figures(manifest, tiers={"hero"})
        unreadable = select_figures(manifest, statuses={"unreadable"})
        self.assertEqual(len(hero), 3)
        self.assertEqual(len(unreadable), 3)

    def test_validate_paths(self) -> None:
        manifest = load_figure_manifest(MANIFEST_PATH, validate_paths=True, repo_root=REPO_ROOT)
        self.assertEqual(len(manifest.figures), 11)

    def test_invalid_tier_raises(self) -> None:
        payload = json.loads(MANIFEST_PATH.read_text())
        payload["figures"][0]["tier"] = "not_a_tier"
        with tempfile.NamedTemporaryFile(suffix=".json") as handle:
            Path(handle.name).write_text(json.dumps(payload))
            with self.assertRaises(FigureManifestError):
                load_figure_manifest(handle.name)

    def test_build_repair_plan_uses_playbook_and_appendix_promotion(self) -> None:
        manifest = load_figure_manifest(MANIFEST_PATH)
        plan = build_repair_plan(manifest)

        family_effect_transforms = plan["family_effect_heatmap"]
        self.assertIn("drop_cell_annotations_above_threshold", family_effect_transforms)
        self.assertIn("shorten_contrast_labels", family_effect_transforms)
        self.assertIn("paginate_by_family", family_effect_transforms)

        appendix_transforms = plan["experiment_adjudicative_heatmap"]
        self.assertIn("move_to_appendix", appendix_transforms)


class FigureLayoutTests(unittest.TestCase):
    def test_bucket_verdict_helpers(self) -> None:
        self.assertEqual(parse_verdict_label("[2,1]"), (1, 2))
        self.assertEqual(bucket_verdict_label("[]"), "abstain")
        self.assertEqual(bucket_verdict_label("[4]"), "singleton")
        self.assertEqual(bucket_verdict_label("[2,3]"), "adjacent_subset")
        self.assertEqual(bucket_verdict_label("[2,4]"), "non_adjacent_subset")
        self.assertEqual(bucket_verdict_label("[1,2,3]"), "broad_subset")
        self.assertEqual(
            bucket_verdict_labels(["[]", "[3]", "[2,4]"]),
            ["abstain", "singleton", "non_adjacent_subset"],
        )

    def test_annotation_and_layout_helpers(self) -> None:
        self.assertTrue(
            should_annotate_heatmap(row_count=8, column_count=10, max_cells_for_annotations=100),
        )
        self.assertFalse(
            should_annotate_heatmap(row_count=12, column_count=12, max_cells_for_annotations=100),
        )
        self.assertEqual(paginate_labels(["a", "b", "c", "d", "e"], page_size=2), [["a", "b"], ["c", "d"], ["e"]])
        with self.assertRaises(ValueError):
            paginate_labels(["a"], page_size=0)
        self.assertEqual(suggest_facet_grid(7, max_columns=3), (3, 3))
        self.assertEqual(suggest_facet_grid(0, max_columns=3), (0, 0))


if __name__ == "__main__":
    unittest.main()

