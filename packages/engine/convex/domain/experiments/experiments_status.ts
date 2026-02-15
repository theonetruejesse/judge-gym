import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zQuery } from "../../platform/utils";
import {
  LlmStageSchema,
  ParseStatusSchema,
  modelTypeSchema,
} from "../../models/core";

export const getExperimentStatus = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.object({
    experiment_id: zid("experiments"),
    experiment_tag: z.string().optional(),
    exists: z.boolean(),
    spec_signature: z.string().optional(),
    window: z
      .object({
        start_date: z.string(),
        end_date: z.string(),
        country: z.string(),
        concept: z.string(),
        model_id: modelTypeSchema,
      })
      .optional(),
    evidence_total: z.number().optional(),
    evidence_neutralized: z.number().optional(),
    rubric: z
      .object({
        rubric_id: zid("rubrics"),
        model_id: modelTypeSchema,
        parse_status: ParseStatusSchema.optional(),
      })
      .optional(),
    run_count: z.number().optional(),
    running_count: z.number().optional(),
    latest_run: z
      .object({
        run_id: zid("runs"),
        status: z.string(),
        desired_state: z.string(),
        current_stage: LlmStageSchema.optional(),
        updated_at: z.number().optional(),
      })
      .optional(),
  }),
  handler: async (ctx, { experiment_id }) => {
    const experiment = await ctx.db.get(experiment_id);

    if (!experiment) {
      return { experiment_id, exists: false };
    }

    const window = await ctx.db.get(experiment.window_id);
    const evidence = window
      ? await ctx.db
          .query("evidences")
          .withIndex("by_window_id", (q) => q.eq("window_id", window._id))
          .collect()
      : [];

    const evidence_total = evidence.length;
    const evidence_neutralized = evidence.filter(
      (ev) => (ev.neutralized_content ?? "").trim().length > 0,
    ).length;

    const rubric = await ctx.db
      .query("rubrics")
      .withIndex("by_experiment_model", (q) =>
        q
          .eq("experiment_id", experiment._id)
          .eq("model_id", experiment.config.rubric_stage.model_id),
      )
      .first();

    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();
    const run_count = runs.length;
    const running_count = runs.filter((run) => run.status === "running").length;
    const latest = runs
      .slice()
      .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))[0];

    return {
      experiment_id,
      experiment_tag: experiment.experiment_tag,
      exists: true,
      spec_signature: experiment.spec_signature,
      window: window
        ? {
            start_date: window.start_date,
            end_date: window.end_date,
            country: window.country,
            concept: window.concept,
            model_id: window.model_id,
          }
        : undefined,
      evidence_total,
      evidence_neutralized,
      rubric: rubric
        ? {
            rubric_id: rubric._id,
            model_id: rubric.model_id,
            parse_status: rubric.parse_status,
          }
        : undefined,
      run_count,
      running_count,
      latest_run: latest
        ? {
            run_id: latest._id,
            status: latest.status,
            desired_state: latest.desired_state,
            current_stage: latest.current_stage,
            updated_at: latest.updated_at,
          }
        : undefined,
    };
  },
});
