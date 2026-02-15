import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zMutation, zQuery } from "./platform/utils";
import { api, internal } from "./_generated/api";
import {
  LlmStageSchema,
  LlmRequestStatusSchema,
  ParseStatusSchema,
  modelTypeSchema,
  providerSchema,
  ExperimentStatusSchema,
  TaskTypeSchema,
} from "./models/core";
import {
  ExperimentSpecInputSchema,
  WindowsTableSchema,
} from "./models/experiments";
import { ConfigTemplateBodyInputSchema } from "./models/configs";

export const initEvidenceWindow: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_window: WindowsTableSchema,
  }),
  returns: z.object({
    window_id: zid("windows"),
    reused_window: z.boolean(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.initEvidenceWindow,
      args,
    );
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
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.initExperiment,
      args,
    );
  },
});

export const initExperimentFromTemplate: ReturnType<typeof zMutation> =
  zMutation({
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
    handler: async (ctx, args) => {
      return ctx.runMutation(
        api.domain.experiments.experiments_entrypoints.initExperimentFromTemplate,
        args,
      );
    },
  });

export const collectEvidenceBatch: ReturnType<typeof zAction> = zAction({
  args: z.object({
    window_id: zid("windows"),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    collected: z.number(),
    total: z.number(),
    queued_clean: z.number(),
    queued_neutralize: z.number(),
    queued_abstract: z.number(),
    evidence_batch_id: zid("evidence_batches"),
    evidence_count: z.number(),
  }),
  handler: async (ctx, args) => {
    return ctx.runAction(
      api.domain.evidence.evidence_entrypoints.collectEvidenceBatch,
      args,
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
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.bindExperimentEvidence,
      args,
    );
  },
});

export const insertEvidenceBatch: ReturnType<typeof zMutation> = zMutation({
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
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.insertEvidenceBatch,
      args,
    );
  },
});

export const seedConfigTemplate: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    template_id: z.string(),
    version: z.number().int().min(1),
    schema_version: z.number().int().min(1),
    config_body: ConfigTemplateBodyInputSchema,
    created_by: z.string().optional(),
    notes: z.string().optional(),
  }),
  returns: z.object({
    template_id: z.string(),
    version: z.number(),
    created: z.boolean(),
    spec_signature: z.string(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.configs.configs_entrypoints.seedConfigTemplate,
      args,
    );
  },
});

export const startExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    stop_at_stage: LlmStageSchema.optional(),
    stages: z.array(LlmStageSchema).optional(),
  }),
  returns: z.object({
    ok: z.boolean(),
    run_id: zid("runs").optional(),
    error: z.string().optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.runs.runs_entrypoints.startExperiment,
      args,
    );
  },
});

export const updateRunState: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    run_id: zid("runs"),
    desired_state: z.enum(["running", "paused", "canceled"]),
  }),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx, args) => {
    return ctx.runMutation(api.domain.runs.runs_entrypoints.updateRunState, args);
  },
});

export const queueRubricGeneration: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    sample_count: z.number().min(1).optional(),
  }),
  returns: z.object({ rubric_ids: z.array(zid("rubrics")) }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.queueRubricGeneration,
      args,
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
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.queueScoreGeneration,
      args,
    );
  },
});

export const listEvidenceWindows: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      window_id: zid("windows"),
      start_date: z.string(),
      end_date: z.string(),
      country: z.string(),
      concept: z.string(),
      model_id: modelTypeSchema,
      window_tag: z.string().optional(),
      evidence_count: z.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(api.domain.experiments.experiments_data.listEvidenceWindows, args);
  },
});

export const listEvidenceBatches: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_id: zid("windows") }),
  returns: z.array(
    z.object({
      evidence_batch_id: zid("evidence_batches"),
      window_id: zid("windows"),
      evidence_limit: z.number(),
      evidence_count: z.number(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      api.domain.evidence.evidence_entrypoints.listEvidenceBatches,
      args,
    );
  },
});

export const getEvidenceBatch: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ evidence_batch_id: zid("evidence_batches") }),
  returns: z
    .object({
      evidence_batch_id: zid("evidence_batches"),
      window_id: zid("windows"),
      evidence_limit: z.number(),
      evidence_count: z.number(),
      created_at: z.number(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      api.domain.evidence.evidence_entrypoints.getEvidenceBatch,
      args,
    );
  },
});

export const listEvidenceBatchItems: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ evidence_batch_id: zid("evidence_batches") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      position: z.number(),
      title: z.string(),
      url: z.string(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      api.domain.evidence.evidence_entrypoints.listEvidenceBatchItems,
      args,
    );
  },
});

export const getEvidenceContent: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ evidence_id: zid("evidences") }),
  returns: z
    .object({
      evidence_id: zid("evidences"),
      window_id: zid("windows"),
      title: z.string(),
      url: z.string(),
      raw_content: z.string(),
      cleaned_content: z.string().optional(),
      neutralized_content: z.string().optional(),
      abstracted_content: z.string().optional(),
    })
    .nullable(),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      api.domain.evidence.evidence_entrypoints.getEvidenceContent,
      args,
    );
  },
});

export const listExperimentEvidence: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      position: z.number(),
      title: z.string(),
      url: z.string(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      api.domain.experiments.experiments_data.listExperimentEvidence,
      args,
    );
  },
});

export const getExperimentSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  handler: async (ctx, args) => {
    return ctx.runQuery(api.domain.experiments.experiments_data.getExperimentSummary, args);
  },
});

export const getRunSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, args) => {
    return ctx.runQuery(api.domain.experiments.experiments_data.getRunSummary, args);
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
  handler: async (ctx, args) => {
    return ctx.runMutation(
      api.domain.experiments.experiments_entrypoints.resetExperiment,
      args,
    );
  },
});

export const listQueuedRequests: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      request_id: zid("llm_requests"),
      provider: providerSchema,
      model: modelTypeSchema,
      stage: LlmStageSchema,
      experiment_id: zid("experiments").nullable(),
    }),
  ),
  handler: async (ctx) => {
    const queued = await ctx.db
      .query("llm_requests")
      .withIndex("by_status", (q) => q.eq("status", "queued"))
      .collect();
    return queued.map((req) => ({
      request_id: req._id,
      provider: req.provider,
      model: req.model,
      stage: req.stage,
      experiment_id: req.experiment_id,
    }));
  },
});

export const listBatchesDueForPolling: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ now: z.number() }),
  returns: z.array(
    z.object({
      batch_id: zid("llm_batches"),
      provider: providerSchema,
      model: modelTypeSchema,
      status: z.string(),
      next_poll_at: z.number().optional(),
    }),
  ),
  handler: async (ctx, { now }) => {
    const batches = await ctx.runQuery(
      internal.domain.llm_calls.llm_calls_batches.listBatchesDueForPolling,
      { now },
    );
    return batches.map((batch: any) => ({
      batch_id: batch._id,
      provider: batch.provider,
      model: batch.model,
      status: batch.status,
      next_poll_at: batch.next_poll_at,
    }));
  },
});

export const createBatchFromQueued: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    provider: providerSchema,
    model: modelTypeSchema,
    max_items: z.number().min(1).max(10000),
  }),
  returns: z.object({
    batch_id: zid("llm_batches").nullable(),
    run_id: zid("runs").optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      internal.domain.llm_calls.workflows.llm_calls_batch_queue.createBatchFromQueued,
      args,
    );
  },
});

export const submitBatch: ReturnType<typeof zAction> = zAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({ submitted: z.number() }),
  handler: async (ctx, args) => {
    return ctx.runAction(
      internal.domain.llm_calls.workflows.llm_calls_batch_submit.submitBatch,
      args,
    );
  },
});

export const pollBatch: ReturnType<typeof zAction> = zAction({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
  }),
  returns: z.object({
    status: z.string(),
    next_poll_at: z.number().optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runAction(
      internal.domain.llm_calls.workflows.llm_calls_batch_poll.pollBatch,
      args,
    );
  },
});

export const getQueueStats: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.object({
    totals: z.record(z.string(), z.number()),
    by_stage: z.record(z.string(), z.record(z.string(), z.number())),
    by_provider_model: z.array(
      z.object({
        provider: providerSchema,
        model: modelTypeSchema,
        queued: z.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const requests = await ctx.db.query("llm_requests").collect();

    const totals: Record<string, number> = {
      queued: 0,
      submitted: 0,
      completed: 0,
      error: 0,
      canceled: 0,
    };

    const byStage = new Map<string, Record<string, number>>();
    const byProviderModel = new Map<string, { provider: string; model: string; queued: number }>();

    for (const req of requests) {
      totals[req.status] = (totals[req.status] ?? 0) + 1;
      if (!byStage.has(req.stage)) {
        byStage.set(req.stage, {
          queued: 0,
          submitted: 0,
          completed: 0,
          error: 0,
          canceled: 0,
        });
      }
      const stageCounts = byStage.get(req.stage)!;
      stageCounts[req.status] = (stageCounts[req.status] ?? 0) + 1;

      if (req.status === "queued") {
        const key = `${req.provider}:${req.model}`;
        const entry = byProviderModel.get(key) ?? {
          provider: req.provider,
          model: req.model,
          queued: 0,
        };
        entry.queued += 1;
        byProviderModel.set(key, entry);
      }
    }

    const byStageObj: Record<string, Record<string, number>> = {};
    for (const [stage, counts] of byStage.entries()) {
      byStageObj[stage] = counts;
    }

    return {
      totals: totals as Record<z.infer<typeof LlmRequestStatusSchema>, number>,
      by_stage: byStageObj as Record<
        z.infer<typeof LlmStageSchema>,
        Record<z.infer<typeof LlmRequestStatusSchema>, number>
      >,
      by_provider_model: Array.from(byProviderModel.values()) as Array<{
        provider: z.infer<typeof providerSchema>;
        model: z.infer<typeof modelTypeSchema>;
        queued: number;
      }>,
    };
  },
});

export const listExperiments: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      experiment_id: zid("experiments"),
      experiment_tag: z.string().optional(),
      task_type: TaskTypeSchema,
      status: ExperimentStatusSchema,
      active_run_id: zid("runs").optional(),
      evidence_batch_id: zid("evidence_batches").optional(),
      window_id: zid("windows"),
      window_tag: z.string().optional(),
      evidence_window: z
        .object({
          start_date: z.string(),
          end_date: z.string(),
          country: z.string(),
          concept: z.string(),
          model_id: modelTypeSchema,
        })
        .optional(),
    }),
  ),
  handler: async (ctx) => {
    const experiments = await ctx.db.query("experiments").collect();
    experiments.sort((a, b) => {
      const left = a.experiment_tag ?? a._id;
      const right = b.experiment_tag ?? b._id;
      return left.localeCompare(right);
    });

    const windows = new Map<
      string,
      {
        start_date: string;
        end_date: string;
        country: string;
        concept: string;
        model_id: z.infer<typeof modelTypeSchema>;
        window_tag?: string;
      }
    >();

    const results = [];
    for (const experiment of experiments) {
      let window = windows.get(experiment.window_id);
      if (!window) {
        const windowDoc = await ctx.db.get(experiment.window_id);
        if (windowDoc) {
          window = {
            start_date: windowDoc.start_date,
            end_date: windowDoc.end_date,
            country: windowDoc.country,
            concept: windowDoc.concept,
            model_id: windowDoc.model_id,
            window_tag: windowDoc.window_tag,
          };
          windows.set(experiment.window_id, window);
        }
      }

      results.push({
        experiment_id: experiment._id,
        experiment_tag: experiment.experiment_tag,
        task_type: experiment.task_type,
        status: experiment.status,
        active_run_id: experiment.active_run_id,
        evidence_batch_id: experiment.evidence_batch_id,
        window_id: experiment.window_id,
        window_tag: window?.window_tag,
        evidence_window: window,
      });
    }

    return results;
  },
});

export const getExperimentStates: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    experiment_ids: z.array(zid("experiments")),
  }),
  returns: z.array(
    z.object({
      experiment_id: zid("experiments"),
      experiment_tag: z.string().optional(),
      exists: z.boolean(),
      spec_signature: z.string().optional(),
      window_id: zid("windows").optional(),
      evidence_window: z
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
      evidence_batch: z
        .object({
          evidence_batch_id: zid("evidence_batches"),
          evidence_limit: z.number(),
          evidence_count: z.number(),
        })
        .optional(),
      evidence_bound_count: z.number().optional(),
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
  ),
  handler: async (ctx, { experiment_ids }) => {
    const results = [];
    for (const experiment_id of experiment_ids) {
      const experiment = await ctx.db.get(experiment_id);
      if (!experiment) {
        results.push({
          experiment_id,
          exists: false,
        });
        continue;
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
      const evidenceBatch = experiment.evidence_batch_id
        ? await ctx.db.get(experiment.evidence_batch_id)
        : null;
      const boundEvidence = experiment.evidence_batch_id
        ? await ctx.db
            .query("experiment_evidence")
            .withIndex("by_experiment", (q) =>
              q.eq("experiment_id", experiment._id),
            )
            .collect()
        : [];

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

      results.push({
        experiment_id,
        experiment_tag: experiment.experiment_tag,
        exists: true,
        spec_signature: experiment.spec_signature,
        window_id: experiment.window_id,
        evidence_window: window
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
        evidence_batch: evidenceBatch
          ? {
              evidence_batch_id: evidenceBatch._id,
              evidence_limit: evidenceBatch.evidence_limit,
              evidence_count: evidenceBatch.evidence_count,
            }
          : undefined,
        evidence_bound_count: boundEvidence.length,
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
      });
    }
    return results;
  },
});

export const listRuns: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      run_id: zid("runs"),
      experiment_id: zid("experiments"),
      experiment_tag: z.string().optional(),
      status: z.string(),
      desired_state: z.string(),
      current_stage: LlmStageSchema.optional(),
      stop_at_stage: LlmStageSchema.optional(),
      updated_at: z.number().optional(),
    }),
  ),
  handler: async (ctx) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
    const paused = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "paused"))
      .collect();
    const pending = await ctx.db
      .query("runs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const all = runs.concat(paused, pending);
    const experiments = new Map<string, string | undefined>();

    for (const run of all) {
      if (!experiments.has(run.experiment_id)) {
        const experiment = await ctx.db.get(run.experiment_id);
        experiments.set(run.experiment_id, experiment?.experiment_tag);
      }
    }

    return all.map((run) => ({
      run_id: run._id,
      experiment_id: run.experiment_id,
      experiment_tag: experiments.get(run.experiment_id),
      status: run.status,
      desired_state: run.desired_state,
      current_stage: run.current_stage ?? undefined,
      stop_at_stage: run.stop_at_stage ?? undefined,
      updated_at: run.updated_at,
    }));
  },
});
