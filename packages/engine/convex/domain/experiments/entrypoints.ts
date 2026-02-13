import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import { ExperimentsTableSchema, WindowsTableSchema } from "../../models/experiments";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

// --- Setup ---

export const initExperiment = zMutation({
  args: z.object({
    window: WindowsTableSchema,
    experiment: ExperimentsTableSchema.omit({ status: true, window_id: true }),
  }),
  returns: z.object({
    window_id: zid("windows"),
    experiment_id: zid("experiments"),
    reused_window: z.boolean(),
    reused_experiment: z.boolean(),
  }),
  handler: async (ctx, { window, experiment }) => {
    const existingExperiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment.experiment_tag),
      )
      .unique();
    if (existingExperiment) {
      const existingWindow = await ctx.db.get(existingExperiment.window_id);
      if (!existingWindow) throw new Error("Window not found");
      if (
        existingWindow.start_date !== window.start_date ||
        existingWindow.end_date !== window.end_date ||
        existingWindow.country !== window.country ||
        existingWindow.concept !== window.concept
      ) {
        throw new Error(
          `Window mismatch for experiment_tag=${experiment.experiment_tag}`,
        );
      }
      return {
        window_id: existingExperiment.window_id,
        experiment_id: existingExperiment._id,
        reused_window: true,
        reused_experiment: true,
      };
    }

    const existingWindow = await ctx.db
      .query("windows")
      .withIndex("by_window_key", (q) =>
        q
          .eq("start_date", window.start_date)
          .eq("end_date", window.end_date)
          .eq("country", window.country)
          .eq("concept", window.concept),
      )
      .first();

    const window_id =
      existingWindow?._id ?? (await ctx.db.insert("windows", window));
    const experiment_id = await ctx.db.insert("experiments", {
      ...experiment,
      window_id,
      status: "pending",
    });

    return {
      window_id,
      experiment_id,
      reused_window: Boolean(existingWindow),
      reused_experiment: false,
    };
  },
});

// --- Manual queueing helpers (human-in-loop) ---

export const insertEvidenceBatch = zMutation({
  args: z.object({
    window_id: zid("windows"),
    evidences: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        raw_content: z.string(),
        cleaned_content: z.string().optional(),
        neutralized_content: z.string().optional(),
        abstracted_content: z.string().optional(),
      }),
    ),
  }),
  returns: z.object({
    inserted: z.number(),
    evidence_ids: z.array(zid("evidences")),
  }),
  handler: async (ctx, { window_id, evidences }) => {
    const ids: Id<"evidences">[] = [];
    for (const ev of evidences) {
      const id = await ctx.db.insert("evidences", {
        window_id,
        title: ev.title,
        url: ev.url,
        raw_content: ev.raw_content,
        cleaned_content: ev.cleaned_content,
        neutralized_content: ev.neutralized_content,
        abstracted_content: ev.abstracted_content,
      });
      ids.push(id);
    }
    return { inserted: ids.length, evidence_ids: ids };
  },
});

export const queueRubricGeneration: ReturnType<typeof zMutation> = zMutation({
  args: z.object({ experiment_tag: z.string() }),
  returns: z.object({ rubric_id: zid("rubrics") }),
  handler: async (ctx, { experiment_tag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
    return ctx.runMutation(
      internal.domain.experiments.stages.rubric.workflows.seed_requests
        .seedRubricRequests,
      { experiment_id: experiment._id },
    );
  },
});

export const queueScoreGeneration: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_tag: z.string(),
    sample_count: z.number().min(1),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    samples_created: z.number(),
    evidence_count: z.number(),
  }),
  handler: async (ctx, { experiment_tag, sample_count, evidence_limit }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);
    return ctx.runMutation(
      internal.domain.experiments.stages.scoring.workflows.seed_requests
        .seedScoreRequests,
      {
        experiment_id: experiment._id,
        sample_count,
        evidence_limit,
      },
    );
  },
});
