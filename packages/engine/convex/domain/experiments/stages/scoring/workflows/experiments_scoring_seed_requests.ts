import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildScoreGenPrompt } from "../experiments_scoring_prompts";
import { providerFor } from "../../../../../platform/utils";
import { generateLabelMapping } from "../../../../../platform/utils/randomize";
import {
  resolveRandomizationStrategy,
} from "../../../strategies/experiments_randomization.strategy";
import { resolveScaleStrategy } from "../../../strategies/experiments_scale.strategy";
import type { Id } from "../../../../../_generated/dataModel";

export const seedScoreRequests = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
  }),
  returns: z.object({
    samples_created: z.number(),
    evidence_count: z.number(),
  }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const sample_count = experiment.config.scoring_stage.sample_count;
    const rubrics = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q
          .eq("experiment_id", experiment._id)
          .eq("model_id", experiment.config.rubric_stage.model_id),
      )
      .collect();
    if (rubrics.length === 0) throw new Error("Rubric not found");

    const parsedRubrics = rubrics
      .filter((rubric) => rubric.parse_status === "parsed")
      .sort((a, b) => a._creationTime - b._creationTime);
    if (parsedRubrics.length < sample_count) {
      throw new Error(
        `Not enough parsed rubrics (${parsedRubrics.length}) for sample_count=${sample_count}`,
      );
    }
    const rubricById = new Map(parsedRubrics.map((rubric) => [rubric._id, rubric]));

    const evidenceItems = await ctx.db
      .query("experiment_evidence")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();
    if (evidenceItems.length === 0) {
      throw new Error("Experiment evidence not bound");
    }
    const evidence = [];
    const orderedEvidenceItems = evidenceItems
      .slice()
      .sort((a, b) => a.position - b.position);
    for (const item of orderedEvidenceItems) {
      const ev = await ctx.db.get(item.evidence_id);
      if (ev) evidence.push(ev);
    }
    if (evidence.length === 0) {
      throw new Error("No evidence found for experiment");
    }

    const randomization = resolveRandomizationStrategy(experiment.config);
    const scale = resolveScaleStrategy(experiment.config);

    const samples: Id<"samples">[] = [];

    for (let i = 0; i < sample_count; i++) {
      const display_seed = i + 1;
      const rubric = parsedRubrics[i];
      const label_mapping = randomization.anonLabel
        ? generateLabelMapping(scale.stageCount, display_seed)
        : undefined;

      const sampleId = await ctx.db.insert("samples", {
        experiment_id: experiment._id,
        model_id: experiment.config.scoring_stage.model_id,
        rubric_id: rubric._id,
        label_mapping,
        display_seed,
      });
      samples.push(sampleId);
    }

    for (const sampleId of samples) {
      const sampleDoc = await ctx.db.get(sampleId);
      if (!sampleDoc) continue;

      for (const ev of evidence) {
        const score_id = await ctx.db.insert("scores", {
          sample_id: sampleDoc._id,
          experiment_id: experiment._id,
          model_id: experiment.config.scoring_stage.model_id,
          rubric_id: sampleDoc.rubric_id,
          evidence_id: ev._id,
          abstained: false,
          raw_verdict: null,
          decoded_scores: null,
          parse_status: "pending",
          attempt_count: 0,
        });

        const rubric = rubricById.get(sampleDoc.rubric_id);
        if (!rubric) {
          throw new Error("Rubric not found for sample");
        }

        const prompts = buildScoreGenPrompt({
          config: experiment.config,
          evidence: {
            raw_content: ev.raw_content,
            cleaned_content: ev.cleaned_content,
            neutralized_content: ev.neutralized_content,
            abstracted_content: ev.abstracted_content,
          },
          rubric: { stages: rubric.stages },
          sample: {
            label_mapping: sampleDoc.label_mapping ?? undefined,
            display_seed: sampleDoc.display_seed ?? undefined,
          },
        });

        await ctx.runMutation(
          internal.domain.llm_calls.llm_calls_requests.getOrCreateLlmRequest,
          {
            stage: "score_gen",
            provider: providerFor(experiment.config.scoring_stage.model_id),
            model: experiment.config.scoring_stage.model_id,
            system_prompt: prompts.system_prompt,
            user_prompt: prompts.user_prompt,
            experiment_id: experiment._id,
            rubric_id: sampleDoc.rubric_id,
            sample_id: sampleDoc._id,
            evidence_id: ev._id,
            request_version: 1,
            temperature: 0.2,
            max_tokens: 1200,
          },
        );
      }
    }

    await ctx.runMutation(
      internal.domain.runs.workflows.runs_run_state.refreshRunStageCountsForExperiment,
      { experiment_id: experiment._id, stage: "score_gen" },
    );

    return { samples_created: samples.length, evidence_count: evidence.length };
  },
});
