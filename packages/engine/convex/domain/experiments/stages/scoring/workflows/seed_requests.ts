import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import { internal } from "../../../../../_generated/api";
import { buildScoreGenPrompt } from "../prompts/scoring_prompts";
import { providerFor } from "../../../../../platform/utils";
import { generateLabelMapping, generateId } from "../../../../../platform/utils/randomize";
import {
  resolveRandomizationStrategy,
} from "../../../strategies/randomization.strategy";
import { resolveScaleStrategy } from "../../../strategies/scale.strategy";
import type { Id } from "../../../../../_generated/dataModel";

export const seedScoreRequests = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    sample_count: z.number().min(1),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    samples_created: z.number(),
    evidence_count: z.number(),
  }),
  handler: async (ctx, { experiment_id, sample_count, evidence_limit }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const rubric = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q.eq("experiment_id", experiment._id).eq("model_id", experiment.model_id),
      )
      .first();
    if (!rubric) throw new Error("Rubric not found");
    if (rubric.parse_status !== "parsed") {
      throw new Error("Rubric not parsed; run rubric_gen first");
    }

    const evidenceQuery = ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", experiment.window_id));
    const evidence = evidence_limit
      ? await evidenceQuery.take(evidence_limit)
      : await evidenceQuery.collect();
    if (evidence.length === 0) {
      throw new Error("No evidence found for window");
    }

    const randomization = resolveRandomizationStrategy(experiment.config);
    const scale = resolveScaleStrategy(experiment.config);

    const samples: { sample_id: Id<"samples">; is_swap: boolean }[] = [];

    for (let i = 0; i < sample_count; i++) {
      const display_seed = i + 1;
      const label_mapping = randomization.anonLabel
        ? generateLabelMapping(scale.stageCount, display_seed)
        : undefined;

      const swap_group_id = experiment.swap_policy === "within_experiment"
        ? generateId()
        : undefined;

      const baseSampleId = await ctx.db.insert("samples", {
        experiment_id: experiment._id,
        model_id: experiment.model_id,
        rubric_id: rubric._id,
        is_swap: false,
        label_mapping,
        display_seed,
        swap_group_id,
      });
      samples.push({ sample_id: baseSampleId, is_swap: false });

      if (experiment.swap_policy === "within_experiment") {
        const swapSampleId = await ctx.db.insert("samples", {
          experiment_id: experiment._id,
          model_id: experiment.model_id,
          rubric_id: rubric._id,
          is_swap: true,
          label_mapping,
          display_seed,
          swap_group_id,
        });
        samples.push({ sample_id: swapSampleId, is_swap: true });
      }
    }

    for (const sample of samples) {
      const sampleDoc = await ctx.db.get(sample.sample_id);
      if (!sampleDoc) continue;

      for (const ev of evidence) {
        const score_id = await ctx.db.insert("scores", {
          sample_id: sampleDoc._id,
          experiment_id: experiment._id,
          model_id: experiment.model_id,
          rubric_id: rubric._id,
          evidence_id: ev._id,
          is_swap: sample.is_swap,
          abstained: false,
          raw_verdict: null,
          decoded_scores: null,
          parse_status: "pending",
          attempt_count: 0,
        });

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
            is_swap: sampleDoc.is_swap,
          },
          hypothetical_frame: experiment.hypothetical_frame,
          label_neutralization_mode: experiment.label_neutralization_mode,
        });

        await ctx.runMutation(
          internal.domain.llm_calls.llm_requests.getOrCreateLlmRequest,
          {
            stage: "score_gen",
            provider: providerFor(experiment.model_id),
            model: experiment.model_id,
            system_prompt: prompts.system_prompt,
            user_prompt: prompts.user_prompt,
            experiment_id: experiment._id,
            rubric_id: rubric._id,
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
      internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
      { experiment_id: experiment._id, stage: "score_gen" },
    );

    return { samples_created: samples.length, evidence_count: evidence.length };
  },
});
