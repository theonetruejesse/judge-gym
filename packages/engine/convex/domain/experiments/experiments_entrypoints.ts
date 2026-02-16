import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import {
  ExperimentSpecInputSchema,
  ExperimentSpecNormalizedSchema,
  WindowsInputSchema,
} from "../../models/experiments";
import { normalizeExperimentSpec } from "../../utils/config_normalizer";
import { buildExperimentTag, buildWindowTag } from "../../utils/tags";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";

// --- Setup ---

export const initEvidenceWindow: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_window: WindowsInputSchema,
  }),
  returns: z.object({
    window_id: zid("windows"),
    reused_window: z.boolean(),
  }),
  handler: async (ctx, { evidence_window }) => {
    const existingWindow = await ctx.db
      .query("windows")
      .withIndex("by_window_key", (q) =>
        q
          .eq("start_date", evidence_window.start_date)
          .eq("end_date", evidence_window.end_date)
          .eq("country", evidence_window.country)
          .eq("concept", evidence_window.concept)
          .eq("model_id", evidence_window.model_id),
      )
      .first();

    if (existingWindow) {
      const expectedTag = buildWindowTag(existingWindow);
      if (existingWindow.window_tag !== expectedTag) {
        await ctx.db.patch(existingWindow._id, {
          window_tag: expectedTag,
        });
      }
      return { window_id: existingWindow._id, reused_window: true };
    }

    const window_id = await ctx.db.insert("windows", {
      ...evidence_window,
      window_tag: buildWindowTag(evidence_window),
    });
    return { window_id, reused_window: false };
  },
});

export const initExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    window_id: zid("windows"),
    experiment: ExperimentSpecInputSchema,
    evidence_ids: z.array(zid("evidences")).min(1),
  }),
  returns: z.object({
    window_id: zid("windows"),
    experiment_id: zid("experiments"),
    reused_experiment: z.boolean(),
  }),
  handler: async (ctx, { window_id, experiment, evidence_ids }) => {
    const windowDoc = await ctx.db.get(window_id);
    if (!windowDoc) throw new Error("Window not found");

    const normalizedExperiment = normalizeExperimentSpec(experiment);

    const result = await createExperiment(ctx, {
      window_id,
      experiment: normalizedExperiment,
    });

    await insertExperimentEvidence(ctx, {
      experiment_id: result.experiment_id,
      window_id,
      evidence_ids,
    });

    return {
      window_id: result.window_id,
      experiment_id: result.experiment_id,
      reused_experiment: false,
    };
  },
});

async function createExperiment(
  ctx: MutationCtx,
  args: {
    window_id: Id<"windows">;
    experiment: z.infer<typeof ExperimentSpecNormalizedSchema>;
  },
): Promise<{
  window_id: Id<"windows">;
  experiment_id: Id<"experiments">;
}> {
  const { experiment, window_id } = args;
  const experiment_id = await ctx.db.insert("experiments", {
    ...experiment,
    experiment_tag: buildExperimentTag(),
    window_id,
    status: "pending",
  });

  return {
    window_id,
    experiment_id,
  };
}

async function insertExperimentEvidence(
  ctx: MutationCtx,
  args: {
    experiment_id: Id<"experiments">;
    window_id: Id<"windows">;
    evidence_ids: Id<"evidences">[];
  },
) {
  const { experiment_id, window_id, evidence_ids } = args;
  if (evidence_ids.length === 0) {
    throw new Error("Evidence list cannot be empty");
  }
  const seen = new Set<string>();
  let position = 1;
  for (const evidence_id of evidence_ids) {
    if (seen.has(String(evidence_id))) {
      throw new Error("Duplicate evidence id in selection");
    }
    seen.add(String(evidence_id));
    const evidence = await ctx.db.get(evidence_id);
    if (!evidence) throw new Error("Evidence not found");
    if (evidence.window_id !== window_id) {
      throw new Error("Evidence window mismatch");
    }
    await ctx.db.insert("experiment_evidence", {
      experiment_id,
      evidence_id,
      position,
    });
    position += 1;
  }
  await ctx.db.patch(experiment_id, {
    evidence_count: evidence_ids.length,
  });
}

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

export const resetExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    cleanup_window: z.boolean().optional(),
  }),
  returns: z.object({
    deleted: z.object({
      experiments: z.number(),
      runs: z.number(),
      run_stages: z.number(),
      rubrics: z.number(),
      samples: z.number(),
      scores: z.number(),
      experiment_evidence: z.number(),
      evidences: z.number(),
      windows: z.number(),
      llm_requests: z.number(),
      llm_messages: z.number(),
      llm_batches: z.number(),
      llm_batch_items: z.number(),
    }),
  }),
  handler: async (ctx, { experiment_id, cleanup_window }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const window_id = experiment.window_id;

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

    const experimentEvidence = await ctx.db
      .query("experiment_evidence")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experiment._id))
      .collect();

    let evidences: Array<{ _id: Id<"evidences"> }> = [];
    let windowsDeleted = 0;
    let shouldDeleteWindow = false;

    if (cleanup_window) {
      const allExperiments = await ctx.db.query("experiments").collect();
      const otherExperiments = allExperiments.filter(
        (row) => row.window_id === window_id && row._id !== experiment._id,
      );
      if (otherExperiments.length === 0) {
        shouldDeleteWindow = true;
        evidences = await ctx.db
          .query("evidences")
          .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
          .collect();
      }
    }

    const evidenceIdSet = new Set(evidences.map((row) => row._id));
    const requests = (await ctx.db.query("llm_requests").collect()).filter(
      (req) =>
        req.experiment_id === experiment._id ||
        (cleanup_window && req.evidence_id && evidenceIdSet.has(req.evidence_id)),
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
    for (const row of experimentEvidence) await ctx.db.delete(row._id);
    for (const stage of runStages) await ctx.db.delete(stage._id);
    for (const run of runs) await ctx.db.delete(run._id);
    for (const evidence of evidences) await ctx.db.delete(evidence._id);
    if (cleanup_window && shouldDeleteWindow) {
      await ctx.db.delete(window_id);
      windowsDeleted = 1;
    }
    await ctx.db.delete(experiment._id);

    return {
      deleted: {
        experiments: 1,
        runs: runs.length,
        run_stages: runStages.length,
        rubrics: rubrics.length,
        samples: samples.length,
        scores: scores.length,
        experiment_evidence: experimentEvidence.length,
        evidences: evidences.length,
        windows: windowsDeleted,
        llm_requests: requests.length,
        llm_messages: messageIds.size,
        llm_batches: batches.length,
        llm_batch_items: batchItems.length,
      },
    };
  },
});
