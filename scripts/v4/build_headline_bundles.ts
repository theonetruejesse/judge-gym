import path from "node:path";
import {
  V4_BUILDS_ROOT,
  ensureDir,
  readJson,
  writeJson,
} from "./common";
import {
  HEADLINE_PROVIDERS,
  gilardiExperimentTag,
  zhengExperimentTag,
} from "./headline_matrix";

type ImportBundle = {
  target: string;
  universe: any;
  evidence_set: any;
  package: any;
  evidence_items: any[];
  experiment_blueprints: Array<{
    experiment_tag: string;
    package_tag?: string;
    study_kind: "paper_audit" | "benchmark";
    compatibility_mode: "paper_faithful" | "paper_translated" | "native" | "stress_test";
    rubric_source_kind: "generate" | "imported_rubric" | "imported_codebook" | "direct_labels";
    task_contract: any;
    output_contract: any;
    rubric_config: any;
    scoring_config: any;
  }>;
};

function buildGilardiBlueprints(bundle: ImportBundle) {
  const baseline = bundle.experiment_blueprints[0];
  if (!baseline) {
    throw new Error("Gilardi import bundle is missing a baseline blueprint.");
  }
  return HEADLINE_PROVIDERS.flatMap((model) => {
    const common = {
      package_tag: bundle.package.package_tag,
      study_kind: baseline.study_kind,
      compatibility_mode: baseline.compatibility_mode,
      rubric_source_kind: baseline.rubric_source_kind,
      task_contract: baseline.task_contract,
      output_contract: baseline.output_contract,
      rubric_config: {
        ...baseline.rubric_config,
        model,
      },
    };
    return [
      {
        ...common,
        experiment_tag: gilardiExperimentTag({ condition: "baseline", model }),
        scoring_config: {
          ...baseline.scoring_config,
          model,
          abstain_enabled: false,
          evidence_view: "paper_original",
        },
      },
      {
        ...common,
        experiment_tag: gilardiExperimentTag({ condition: "abstention_on", model }),
        scoring_config: {
          ...baseline.scoring_config,
          model,
          abstain_enabled: true,
          evidence_view: "paper_original",
        },
      },
      {
        ...common,
        experiment_tag: gilardiExperimentTag({ condition: "view_l2_neutralized", model }),
        scoring_config: {
          ...baseline.scoring_config,
          model,
          abstain_enabled: false,
          evidence_view: "l2_neutralized",
        },
      },
    ];
  });
}

function buildZhengBlueprints(bundle: ImportBundle) {
  const baseline = bundle.experiment_blueprints[0];
  if (!baseline) {
    throw new Error("Zheng import bundle is missing a baseline blueprint.");
  }
  return HEADLINE_PROVIDERS.flatMap((model) => {
    const common = {
      package_tag: bundle.package.package_tag,
      study_kind: baseline.study_kind,
      compatibility_mode: baseline.compatibility_mode,
      rubric_source_kind: baseline.rubric_source_kind,
      task_contract: baseline.task_contract,
      output_contract: baseline.output_contract,
      rubric_config: {
        ...baseline.rubric_config,
        model,
      },
    };
    return [
      {
        ...common,
        experiment_tag: zhengExperimentTag({ condition: "baseline", model }),
        scoring_config: {
          ...baseline.scoring_config,
          model,
          abstain_enabled: false,
          evidence_view: "paper_original",
        },
      },
      {
        ...common,
        experiment_tag: zhengExperimentTag({ condition: "abstention_on", model }),
        scoring_config: {
          ...baseline.scoring_config,
          model,
          abstain_enabled: true,
          evidence_view: "paper_original",
        },
      },
    ];
  });
}

async function main() {
  const gilardiBuildRoot = path.join(V4_BUILDS_ROOT, "gilardi");
  const zhengBuildRoot = path.join(V4_BUILDS_ROOT, "zheng");
  await ensureDir(gilardiBuildRoot);
  await ensureDir(zhengBuildRoot);

  const gilardiImportBundle = await readJson<ImportBundle>(
    path.join(gilardiBuildRoot, "import_bundle.json"),
  );
  const zhengImportBundle = await readJson<ImportBundle>(
    path.join(zhengBuildRoot, "pair_v2_import_bundle.json"),
  );

  const gilardiHeadlineBundle = {
    ...gilardiImportBundle,
    evidence_set: {
      ...gilardiImportBundle.evidence_set,
      title: "Gilardi relevance headline set",
    },
    experiment_blueprints: buildGilardiBlueprints(gilardiImportBundle),
  };
  const zhengHeadlineBundle = {
    ...zhengImportBundle,
    evidence_set: {
      ...zhengImportBundle.evidence_set,
      title: "Zheng MT-Bench pair-v2 headline set",
    },
    experiment_blueprints: buildZhengBlueprints(zhengImportBundle),
  };

  await writeJson(path.join(gilardiBuildRoot, "headline_bundle.json"), gilardiHeadlineBundle);
  await writeJson(path.join(zhengBuildRoot, "headline_bundle.json"), zhengHeadlineBundle);

  console.log(JSON.stringify({
    gilardi_experiments: gilardiHeadlineBundle.experiment_blueprints.length,
    zheng_experiments: zhengHeadlineBundle.experiment_blueprints.length,
    gilardi_bundle: path.join(gilardiBuildRoot, "headline_bundle.json"),
    zheng_bundle: path.join(zhengBuildRoot, "headline_bundle.json"),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
