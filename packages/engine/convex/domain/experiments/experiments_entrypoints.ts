import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation } from "../../platform/utils";
import {
  ExperimentSpecInputSchema,
  ExperimentSpecNormalizedSchema,
  WindowsInputSchema,
  WindowsTableSchema,
} from "../../models/experiments";
import { internal } from "../../_generated/api";
import { buildExperimentSpecSignature } from "../../utils/spec_signature";
import { normalizeExperimentSpec } from "../../utils/config_normalizer";
import { ConfigTemplatesTableSchema } from "../../models/configs";
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
      if (!existingWindow.window_tag) {
        await ctx.db.patch(existingWindow._id, {
          window_tag: buildWindowTag(existingWindow),
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
    template_id: z.string().optional(),
    template_version: z.number().optional(),
  }),
  returns: z.object({
    window_id: zid("windows"),
    experiment_id: zid("experiments"),
    reused_experiment: z.boolean(),
  }),
  handler: async (
    ctx,
    { window_id, experiment, template_id, template_version },
  ) => {
    const windowDoc = await ctx.db.get(window_id);
    if (!windowDoc) throw new Error("Window not found");

    const normalizedExperiment = normalizeExperimentSpec(experiment);
    const specSignature = buildExperimentSpecSignature({
      evidence_window: windowDoc,
      experiment: normalizedExperiment,
    });
    const configTemplateId = template_id ?? specSignature;
    const configTemplateVersion = template_version ?? 1;

    await ensureConfigTemplate(ctx, {
      template_id: configTemplateId,
      version: configTemplateVersion,
      evidence_window: windowDoc,
      experiment: normalizedExperiment,
    });

    const result = await ensureExperimentWithSpec(ctx, {
      window_id,
      evidence_window: windowDoc,
      experiment: normalizedExperiment,
      spec_signature: specSignature,
      config_template_id: configTemplateId,
      config_template_version: configTemplateVersion,
    });

    return {
      window_id: result.window_id,
      experiment_id: result.experiment_id,
      reused_experiment: result.reused_experiment,
    };
  },
});

export const initExperimentFromTemplate: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    template_id: z.string(),
    version: z.number().int().min(1),
  }),
  returns: z.object({
    window_id: zid("windows"),
    experiment_id: zid("experiments"),
    reused_window: z.boolean(),
    reused_experiment: z.boolean(),
  }),
  handler: async (ctx, { template_id, version }) => {
    const template = (await ctx.runQuery(
      internal.domain.configs.configs_repo.getConfigTemplate,
      { template_id, version },
    )) as z.infer<typeof ConfigTemplatesTableSchema> | null;
    if (!template) {
      throw new Error(`Config template not found: ${template_id} v${version}`);
    }
    const { evidence_window, experiment } = template.config_body;
    const window = await ctx.db
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
    const window_id =
      window?._id ??
      (await ctx.db.insert("windows", {
        ...evidence_window,
        window_tag: buildWindowTag(evidence_window),
      }));
    const reused_window = Boolean(window);
    if (window && !window.window_tag) {
      await ctx.db.patch(window._id, { window_tag: buildWindowTag(window) });
    }
    const result = await ensureExperimentWithSpec(ctx, {
      window_id,
      evidence_window,
      experiment,
      spec_signature: template.spec_signature,
      config_template_id: template_id,
      config_template_version: version,
    });
    return {
      window_id: result.window_id,
      experiment_id: result.experiment_id,
      reused_window,
      reused_experiment: result.reused_experiment,
    };
  },
});

async function ensureConfigTemplate(
  ctx: MutationCtx,
  args: {
    template_id: string;
    version: number;
    evidence_window: z.infer<typeof WindowsTableSchema>;
    experiment: z.infer<typeof ExperimentSpecNormalizedSchema>;
  },
) {
  const spec_signature = buildExperimentSpecSignature({
    evidence_window: args.evidence_window,
    experiment: args.experiment,
  });
  const existing = await ctx.runQuery(
    internal.domain.configs.configs_repo.getConfigTemplate,
    { template_id: args.template_id, version: args.version },
  );
  if (existing) {
    if (existing.spec_signature !== spec_signature) {
      throw new Error(
        `Config template mismatch for ${args.template_id} v${args.version}`,
      );
    }
    return;
  }

  await ctx.runMutation(internal.domain.configs.configs_repo.createConfigTemplate, {
    template_id: args.template_id,
    version: args.version,
    schema_version: 1,
    config_body: {
      evidence_window: args.evidence_window,
      experiment: args.experiment,
    },
    created_at: Date.now(),
    created_by: "initExperiment",
    notes: "auto-generated by initExperiment",
    spec_signature,
  });
}

async function ensureExperimentWithSpec(
  ctx: MutationCtx,
  args: {
    window_id: Id<"windows">;
    evidence_window: z.infer<typeof WindowsTableSchema>;
    experiment: z.infer<typeof ExperimentSpecNormalizedSchema>;
    spec_signature: string;
    config_template_id: string;
    config_template_version: number;
  },
): Promise<{
  window_id: Id<"windows">;
  experiment_id: Id<"experiments">;
  reused_experiment: boolean;
}> {
  const { evidence_window, experiment, window_id } = args;
  const requestedSignature = args.spec_signature;
  const existingExperiment = await ctx.db
    .query("experiments")
    .withIndex("by_window_spec", (q) =>
      q.eq("window_id", window_id).eq("spec_signature", requestedSignature),
    )
    .unique();
  if (existingExperiment) {
    const patch: Record<string, unknown> = {};
    if (
      existingExperiment.config_template_id !== args.config_template_id ||
      existingExperiment.config_template_version !==
        args.config_template_version
    ) {
      patch.config_template_id = args.config_template_id;
      patch.config_template_version = args.config_template_version;
    }
    if (!existingExperiment.experiment_tag) {
      patch.experiment_tag = buildExperimentTag();
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(existingExperiment._id, patch);
    }
    return {
      window_id,
      experiment_id: existingExperiment._id,
      reused_experiment: true,
    };
  }

  const experiment_id = await ctx.db.insert("experiments", {
    ...experiment,
    experiment_tag: buildExperimentTag(),
    window_id,
    spec_signature: requestedSignature,
    status: "pending",
    config_template_id: args.config_template_id,
    config_template_version: args.config_template_version,
  });

  return {
    window_id,
    experiment_id,
    reused_experiment: false,
  };
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

export const queueRubricGeneration: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    sample_count: z.number().min(1).optional(),
  }),
  returns: z.object({ rubric_ids: z.array(zid("rubrics")) }),
  handler: async (ctx, { experiment_id, sample_count }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    return ctx.runMutation(
      internal.domain.experiments.stages.rubric.workflows.experiments_rubric_seed_requests
        .seedRubricRequests,
      { experiment_id: experiment._id, sample_count },
    );
  },
});

export const queueScoreGeneration: ReturnType<typeof zMutation> = zMutation({
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
    return ctx.runMutation(
      internal.domain.experiments.stages.scoring.workflows.experiments_scoring_seed_requests
        .seedScoreRequests,
      { experiment_id: experiment._id },
    );
  },
});

export const bindExperimentEvidence: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    evidence_batch_id: zid("evidence_batches"),
  }),
  returns: z.object({
    evidence_batch_id: zid("evidence_batches"),
    evidence_count: z.number(),
    bound_count: z.number(),
    evidence_cap: z.number(),
  }),
  handler: async (ctx, { experiment_id, evidence_batch_id }) => {
    const experiment = await ctx.db.get(experiment_id);
    if (!experiment) throw new Error("Experiment not found");
    if (experiment.evidence_batch_id) {
      throw new Error("Experiment already bound to an evidence batch");
    }

    const batch = await ctx.db.get(evidence_batch_id);
    if (!batch) throw new Error("Evidence batch not found");
    if (batch.window_id !== experiment.window_id) {
      throw new Error("Evidence batch window mismatch");
    }

    const batchItems = await ctx.db
      .query("evidence_batch_items")
      .withIndex("by_batch", (q) => q.eq("batch_id", evidence_batch_id))
      .collect();
    if (batchItems.length === 0) {
      throw new Error("Evidence batch is empty");
    }
    const evidence_cap = experiment.config.scoring_stage.evidence_cap;
    if (batchItems.length < evidence_cap) {
      throw new Error(
        `Evidence batch has ${batchItems.length} items, below evidence_cap=${evidence_cap}`,
      );
    }

    const ordered = batchItems
      .slice()
      .sort((a, b) => a.position - b.position)
      .slice(0, evidence_cap);

    for (const item of ordered) {
      await ctx.db.insert("experiment_evidence", {
        experiment_id: experiment._id,
        evidence_batch_id,
        evidence_id: item.evidence_id,
        position: item.position,
      });
    }

    await ctx.db.patch(experiment._id, { evidence_batch_id });

    return {
      evidence_batch_id,
      evidence_count: batchItems.length,
      bound_count: ordered.length,
      evidence_cap,
    };
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
      run_configs: z.number(),
      rubrics: z.number(),
      samples: z.number(),
      scores: z.number(),
      experiment_evidence: z.number(),
      evidence_batches: z.number(),
      evidence_batch_items: z.number(),
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
    const runConfigIds = new Set(
      runs.map((run) => run.run_config_id).filter(Boolean),
    );

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

    let evidenceBatchItems: Array<{ _id: Id<"evidence_batch_items"> }> = [];
    let evidenceBatches: Array<{ _id: Id<"evidence_batches"> }> = [];
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
        evidenceBatches = await ctx.db
          .query("evidence_batches")
          .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
          .collect();

        for (const batch of evidenceBatches) {
          const items = await ctx.db
            .query("evidence_batch_items")
            .withIndex("by_batch", (q) => q.eq("batch_id", batch._id))
            .collect();
          evidenceBatchItems.push(...items);
        }

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
    for (const runConfigId of runConfigIds) {
      await ctx.db.delete(runConfigId);
    }
    for (const item of evidenceBatchItems) await ctx.db.delete(item._id);
    for (const batch of evidenceBatches) await ctx.db.delete(batch._id);
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
        run_configs: runConfigIds.size,
        rubrics: rubrics.length,
        samples: samples.length,
        scores: scores.length,
        experiment_evidence: experimentEvidence.length,
        evidence_batches: evidenceBatches.length,
        evidence_batch_items: evidenceBatchItems.length,
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
