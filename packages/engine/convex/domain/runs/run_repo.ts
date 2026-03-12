import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { RunsTableSchema } from "../../models/experiments";
import type { Doc, Id } from "../../_generated/dataModel";
import { generateSeeds, shuffleWithSeed } from "../../utils/randomize";
import {
  normalizeExperimentConfig,
  resolveEvidenceStrategy,
  type ExperimentConfig,
} from "./run_strategies";

const CreateRunArgsSchema = RunsTableSchema.pick({
  experiment_id: true,
  target_count: true,
});

type EvidenceDoc = Doc<"evidences">;

function estimateEvidenceTokens(text: string | null | undefined) {
  return Math.ceil((text ?? "").length / 4);
}

function getEvidenceContentForConfig(
  evidence: EvidenceDoc,
  config: ExperimentConfig,
) {
  const evidenceStrategy = resolveEvidenceStrategy(config);
  return evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
}

function buildBundleForSample(
  evidences: EvidenceDoc[],
  config: ExperimentConfig,
  seed: number,
) {
  const grouping = config.scoring_config.evidence_grouping;
  if (grouping.mode !== "bundle") {
    return [] as EvidenceDoc[];
  }

  const shuffledAll = shuffleWithSeed(evidences, seed);
  if (grouping.bundle_size === "all") {
    return shuffledAll;
  }

  if (grouping.bundle_strategy === "global_random") {
    return shuffledAll.slice(0, grouping.bundle_size);
  }

  const byWindow = new Map<string, EvidenceDoc[]>();
  for (const evidence of shuffledAll) {
    const key = String(evidence.window_id);
    const current = byWindow.get(key) ?? [];
    current.push(evidence);
    byWindow.set(key, current);
  }

  const orderedWindowIds = shuffleWithSeed(Array.from(byWindow.keys()), seed ^ 0x9e3779b9);
  const selected: EvidenceDoc[] = [];
  const selectedIds = new Set<string>();

  for (const windowId of orderedWindowIds) {
    const candidates = byWindow.get(windowId) ?? [];
    const choice = candidates.find((evidence) => !selectedIds.has(String(evidence._id)));
    if (!choice) continue;
    selected.push(choice);
    selectedIds.add(String(choice._id));
    if (selected.length >= grouping.bundle_size) {
      return selected;
    }
  }

  for (const evidence of shuffledAll) {
    if (selectedIds.has(String(evidence._id))) continue;
    selected.push(evidence);
    selectedIds.add(String(evidence._id));
    if (selected.length >= grouping.bundle_size) {
      break;
    }
  }

  return selected;
}

function assertBundleFitsBudget(
  evidences: EvidenceDoc[],
  config: ExperimentConfig,
) {
  const grouping = config.scoring_config.evidence_grouping;
  if (grouping.mode !== "bundle") return;

  const estimatedTokens = evidences.reduce((sum, evidence) => {
    return sum + estimateEvidenceTokens(getEvidenceContentForConfig(evidence, config));
  }, 0);

  if (estimatedTokens > grouping.max_estimated_input_tokens) {
    throw new Error(
      `Bundle estimated input tokens ${estimatedTokens} exceed max_estimated_input_tokens `
      + `${grouping.max_estimated_input_tokens}`,
    );
  }
}

export const createRun = zInternalMutation({
  args: CreateRunArgsSchema,
  returns: zid("runs"),
  handler: async (ctx, args) => {
    const { experiment_id, target_count } = args;
    const rawExperiment = await ctx.db.get(experiment_id);
    if (!rawExperiment) throw new Error("Experiment not found");
    const experiment = {
      ...rawExperiment,
      ...normalizeExperimentConfig(rawExperiment),
    };

    const run_id = await ctx.db.insert("runs", {
      experiment_id,
      target_count,
      completed_count: 0,
      status: "start",
      current_stage: "rubric_gen",
    });

    const baseSeed = (Math.random() * 0xffffffff) | 0;
    const seeds = generateSeeds(baseSeed, args.target_count);
    const sampleIds: Id<"samples">[] = [];
    for (let i = 0; i < args.target_count; i++) {
      const seed = seeds[i];
      const sample_id = await ctx.db.insert("samples", {
        run_id,
        experiment_id: experiment._id,
        model: rawExperiment.scoring_config.model,
        seed,
        rubric_id: null,
        rubric_critic_id: null,
        score_count: 0,
        score_critic_count: 0,
      });
      sampleIds.push(sample_id);
    }

    const evidenceLinks = await ctx.db
      .query("pool_evidences")
      .withIndex("by_pool", (q) => q.eq("pool_id", experiment.pool_id))
      .collect();
    const orderedLinks = evidenceLinks
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime);
    const orderedEvidences = (
      await Promise.all(orderedLinks.map((link) => ctx.db.get(link.evidence_id)))
    ).filter((value): value is EvidenceDoc => value != null);

    for (const sample_id of sampleIds) {
      const sample = await ctx.db.get(sample_id);
      if (!sample) continue;
      const grouping = experiment.scoring_config.evidence_grouping;

      if (grouping.mode === "single_evidence") {
        for (const evidence of orderedEvidences) {
          const scoreTargetId = await ctx.db.insert("sample_score_targets", {
            run_id,
            sample_id,
            target_mode: "single_evidence",
            score_id: null,
            score_critic_id: null,
          });
          await ctx.db.insert("sample_score_target_items", {
            score_target_id: scoreTargetId,
            evidence_id: evidence._id,
            window_id: evidence.window_id,
            position: 0,
          });
        }
        continue;
      }

      const bundle = buildBundleForSample(orderedEvidences, experiment, sample.seed);
      assertBundleFitsBudget(bundle, experiment);

      const scoreTargetId = await ctx.db.insert("sample_score_targets", {
        run_id,
        sample_id,
        target_mode: "bundle",
        score_id: null,
        score_critic_id: null,
      });

      for (const [index, evidence] of bundle.entries()) {
        await ctx.db.insert("sample_score_target_items", {
          score_target_id: scoreTargetId,
          evidence_id: evidence._id,
          window_id: evidence.window_id,
          position: index,
        });
      }
    }

    return run_id;
  },
});

export const getRun = zInternalQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, args): Promise<Doc<"runs">> => {
    const run = await ctx.db.get(args.run_id);
    if (!run) throw new Error("Run not found");
    return run;
  },
});
