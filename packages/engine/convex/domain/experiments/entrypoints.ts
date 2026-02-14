import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import { ExperimentsTableSchema, WindowsTableSchema } from "../../models/experiments";
import { internal } from "../../_generated/api";
import { buildExperimentSpecSignature } from "../../utils/spec_signature";
import type { Id } from "../../_generated/dataModel";

// --- Setup ---

export const initExperiment = zMutation({
  args: z.object({
    window: WindowsTableSchema,
    experiment: ExperimentsTableSchema.omit({
      status: true,
      window_id: true,
      spec_signature: true,
    }),
  }),
  returns: z.object({
    window_id: zid("windows"),
    experiment_id: zid("experiments"),
    reused_window: z.boolean(),
    reused_experiment: z.boolean(),
  }),
  handler: async (ctx, { window, experiment }) => {
    const requestedSignature = buildExperimentSpecSignature({
      window,
      experiment,
    });
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
      const existingSignature =
        existingExperiment.spec_signature ??
        buildExperimentSpecSignature({
          window: existingWindow,
          experiment: {
            experiment_tag: existingExperiment.experiment_tag,
            task_type: existingExperiment.task_type,
            config: existingExperiment.config,
            ground_truth: existingExperiment.ground_truth,
            hypothetical_frame: existingExperiment.hypothetical_frame,
            label_neutralization_mode: existingExperiment.label_neutralization_mode,
          },
        });
      if (existingSignature !== requestedSignature) {
        throw new Error(
          `Experiment config mismatch for experiment_tag=${experiment.experiment_tag}`,
        );
      }
      if (!existingExperiment.spec_signature) {
        await ctx.db.patch(existingExperiment._id, {
          spec_signature: existingSignature,
        });
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
      spec_signature: requestedSignature,
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
  args: z.object({
    experiment_tag: z.string(),
    sample_count: z.number().min(1).optional(),
  }),
  returns: z.object({ rubric_ids: z.array(zid("rubrics")) }),
  handler: async (ctx, { experiment_tag, sample_count }) => {
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
      { experiment_id: experiment._id, sample_count },
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

export const resetExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({ experiment_tag: z.string() }),
  returns: z.object({
    deleted: z.object({
      experiments: z.number(),
      runs: z.number(),
      run_stages: z.number(),
      rubrics: z.number(),
      samples: z.number(),
      scores: z.number(),
      llm_requests: z.number(),
      llm_messages: z.number(),
      llm_batches: z.number(),
      llm_batch_items: z.number(),
    }),
  }),
  handler: async (ctx, { experiment_tag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) =>
        q.eq("experiment_tag", experiment_tag),
      )
      .unique();
    if (!experiment)
      throw new Error(`Experiment not found: ${experiment_tag}`);

    const runs = await ctx.db
      .query("runs")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();
    const runIds = new Set(runs.map((run) => run._id));

    const runStages: Array<{ _id: Id<"run_stages"> }> = [];
    for (const run of runs) {
      const stages = await ctx.db
        .query("run_stages")
        .withIndex("by_run", (q) => q.eq("run_id", run._id))
        .collect();
      runStages.push(...stages);
    }

    const rubrics = (await ctx.db.query("rubrics").collect()).filter(
      (rubric) => rubric.experiment_id === experiment._id,
    );

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const scores = await ctx.db
      .query("scores")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    const requests = (await ctx.db.query("llm_requests").collect()).filter(
      (req) => req.experiment_id === experiment._id,
    );

    const batchItems: Array<{ _id: Id<"llm_batch_items">; batch_id: Id<"llm_batches"> }> = [];
    for (const req of requests) {
      const items = await ctx.db
        .query("llm_batch_items")
        .withIndex("by_request", (q) => q.eq("request_id", req._id))
        .collect();
      batchItems.push(...items);
    }
    const batchIds = new Set(batchItems.map((item) => item.batch_id));

    for (const runId of runIds) {
      const runBatches = (await ctx.db.query("llm_batches").collect()).filter(
        (batch) => batch.run_id === runId,
      );
      for (const batch of runBatches) batchIds.add(batch._id);
    }

    const batches = (await ctx.db.query("llm_batches").collect()).filter(
      (batch) => batchIds.has(batch._id),
    );

    const messageIds = new Set<Id<"llm_messages">>();
    for (const rubric of rubrics) {
      if (rubric.rubricer_message_id) messageIds.add(rubric.rubricer_message_id);
      if (rubric.rubric_critic_message_id)
        messageIds.add(rubric.rubric_critic_message_id);
    }
    for (const score of scores) {
      if (score.score_message_id) messageIds.add(score.score_message_id);
      if (score.score_critic_message_id)
        messageIds.add(score.score_critic_message_id);
    }
    for (const req of requests) {
      if (req.result_message_id) messageIds.add(req.result_message_id);
    }

    for (const item of batchItems) await ctx.db.delete(item._id);
    for (const batch of batches) await ctx.db.delete(batch._id);
    for (const req of requests) await ctx.db.delete(req._id);
    for (const messageId of messageIds) await ctx.db.delete(messageId);
    for (const score of scores) await ctx.db.delete(score._id);
    for (const sample of samples) await ctx.db.delete(sample._id);
    for (const rubric of rubrics) await ctx.db.delete(rubric._id);
    for (const stage of runStages) await ctx.db.delete(stage._id);
    for (const run of runs) await ctx.db.delete(run._id);
    await ctx.db.delete(experiment._id);

    return {
      deleted: {
        experiments: 1,
        runs: runs.length,
        run_stages: runStages.length,
        rubrics: rubrics.length,
        samples: samples.length,
        scores: scores.length,
        llm_requests: requests.length,
        llm_messages: messageIds.size,
        llm_batches: batches.length,
        llm_batch_items: batchItems.length,
      },
    };
  },
});
