import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import {
  classifyTaskFailure,
} from "@judge-gym/engine-settings";
import { modelTypeSchema } from "@judge-gym/engine-settings/provider";
import type { Doc, Id } from "../_generated/dataModel";
import { ExperimentsTableSchema, RunStageSchema } from "../models/experiments";
import { emitTraceEvent } from "../domain/telemetry/emit";

const RunScoreTargetListItemSchema = z.object({
  score_target_id: zid("sample_score_targets"),
  sample_id: zid("samples"),
  score_id: zid("scores").nullable(),
  score_critic_id: zid("score_critics").nullable(),
  items: z.array(z.object({
    evidence_item_id: zid("evidence_items"),
    evidence_view_id: zid("evidence_views").nullable(),
    position: z.number(),
    title: z.string().nullable(),
    url: z.string().nullable(),
  })),
});

function parseAttemptOrdinal(attemptKey: string | null | undefined): number | null {
  if (!attemptKey) {
    return null;
  }
  const match = attemptKey.match(/:attempt:(\d+)$/);
  if (!match) {
    return null;
  }
  const ordinal = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(ordinal) ? ordinal : null;
}

function deriveFailureClass(errorMessage: string | null): string | null {
  if (!errorMessage) {
    return null;
  }
  return classifyTaskFailure(new Error(errorMessage));
}

async function hydrateRunScoreTargets(
  ctx: any,
  scoreTargets: Array<Doc<"sample_score_targets">>,
) {
  const results: Array<z.infer<typeof RunScoreTargetListItemSchema>> = [];
  for (const scoreTarget of scoreTargets) {
    const items = await ctx.db
      .query("sample_score_target_items")
      .withIndex("by_score_target", (q: any) => q.eq("score_target_id", scoreTarget._id))
      .collect();

    const hydratedItems: Array<z.infer<typeof RunScoreTargetListItemSchema.shape.items.element>> = [];
    for (const item of items.slice().sort((a: any, b: any) => a.position - b.position)) {
      const evidenceItem = await ctx.db.get(item.evidence_item_id);
      if (!evidenceItem) continue;
      hydratedItems.push({
        evidence_item_id: evidenceItem._id,
        evidence_view_id: item.evidence_view_id ?? null,
        position: item.position,
        title: evidenceItem.title ?? null,
        url: evidenceItem.source_url ?? null,
      });
    }

    results.push({
      score_target_id: scoreTarget._id,
      sample_id: scoreTarget.sample_id,
      score_id: scoreTarget.score_id,
      score_critic_id: scoreTarget.score_critic_id,
      items: hydratedItems,
    });
  }

  return results;
}
const ExperimentConfigInputSchema = ExperimentsTableSchema.pick({
  study_kind: true,
  evidence_source_kind: true,
  rubric_source_kind: true,
  compatibility_mode: true,
  task_contract: true,
  output_contract: true,
  rubric_config: true,
  scoring_config: true,
}).partial({
  study_kind: true,
  evidence_source_kind: true,
  rubric_source_kind: true,
  compatibility_mode: true,
  task_contract: true,
  output_contract: true,
});

export const initExperiment: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_tag: z.string().optional(),
    experiment_config: ExperimentConfigInputSchema,
    evidence_set_id: zid("evidence_sets").optional(),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
  }),
  handler: async (ctx, args) => {
    const { experiment_config, evidence_set_id } = args;
    if (!evidence_set_id) {
      throw new Error(
        "Greenfield V4 experiments require evidence_set_id. "
        + "Legacy pool-backed experiment initialization is removed.",
      );
    }

    const experiment_id: Id<"experiments"> = await ctx.runMutation(internal.domain.runs.experiments_repo.createExperiment,
      {
        experiment_tag: args.experiment_tag,
        ...experiment_config,
        evidence_set_id,
      }
    );
    const evidenceCount = (
      await ctx.runQuery(internal.domain.evidence.evidence_repo.listEvidenceSetItems, {
        evidence_set_id,
      })
    ).length;
    await emitTraceEvent(ctx, {
      trace_id: `experiment:${experiment_id}`,
      entity_type: "run",
      entity_id: String(experiment_id),
      event_name: "experiment_initialized",
      status: "start",
      payload_json: JSON.stringify({
        evidence_count: evidenceCount,
        scoring_model: experiment_config.scoring_config.model,
      }),
    });

    return { experiment_id };
  },
});

export const startExperimentRun: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    target_count: z.number().int().min(1),
    pause_after: RunStageSchema.nullable().optional(),
  }),
  returns: z.object({
    run_id: zid("runs"),
    samples_created: z.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(
      internal.domain.runs.run_service.startRunFlow,
      args,
    );
    await emitTraceEvent(ctx, {
      trace_id: `run:${result.run_id}`,
      entity_type: "run",
      entity_id: String(result.run_id),
      event_name: "run_started",
      stage: "rubric_gen",
      status: "queued",
      payload_json: JSON.stringify({
        experiment_id: args.experiment_id,
        target_count: args.target_count,
      }),
    });
    return {
      run_id: result.run_id,
      samples_created: args.target_count,
    };
  },
});

// todo, clean up the list functions

export const listExperiments: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      experiment_id: zid("experiments"),
      experiment_tag: z.string(),
      study_kind: ExperimentsTableSchema.shape.study_kind,
      evidence_source_kind: ExperimentsTableSchema.shape.evidence_source_kind,
      evidence_set_id: zid("evidence_sets"),
      evidence_set_tag: z.string().nullable(),
      evidence_set_quality_label: z.string(),
      evidence_set_source_kind: z.string(),
      rubric_source_kind: ExperimentsTableSchema.shape.rubric_source_kind,
      compatibility_mode: ExperimentsTableSchema.shape.compatibility_mode,
      task_contract: ExperimentsTableSchema.shape.task_contract,
      output_contract: ExperimentsTableSchema.shape.output_contract,
      rubric_config: ExperimentsTableSchema.shape.rubric_config,
      scoring_config: ExperimentsTableSchema.shape.scoring_config,
      total_count: z.number(),
      evidence_selected_count: z.number(),
      status: z.string(),
      latest_run: z
        .object({
          run_id: zid("runs"),
          status: z.string(),
          current_stage: z.string(),
          target_count: z.number(),
          completed_count: z.number(),
          pause_after: RunStageSchema.nullable(),
          current_stage_progress: z.object({
            completed: z.number(),
            failed: z.number(),
            pending: z.number(),
            total: z.number(),
            status: z.string(),
          }),
          stage_counts: z.object({
            rubric_gen: z.number(),
            rubric_critic: z.number(),
            score_gen: z.number(),
            score_critic: z.number(),
          }),
          created_at: z.number(),
          has_failures: z.boolean(),
        })
        .optional(),
    }),
  ),
  handler: async (ctx) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.listExperiments,
      {},
    );
  },
});

export const getExperimentSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.object({
    experiment_id: zid("experiments"),
    experiment_tag: z.string(),
    study_kind: ExperimentsTableSchema.shape.study_kind,
    evidence_source_kind: ExperimentsTableSchema.shape.evidence_source_kind,
    evidence_set_id: zid("evidence_sets"),
    evidence_set_tag: z.string().nullable(),
    evidence_set_quality_label: z.string(),
    evidence_set_source_kind: z.string(),
    rubric_source_kind: ExperimentsTableSchema.shape.rubric_source_kind,
    compatibility_mode: ExperimentsTableSchema.shape.compatibility_mode,
    task_contract: ExperimentsTableSchema.shape.task_contract,
    output_contract: ExperimentsTableSchema.shape.output_contract,
    rubric_config: ExperimentsTableSchema.shape.rubric_config,
    scoring_config: ExperimentsTableSchema.shape.scoring_config,
    total_count: z.number(),
    evidence_selected_count: z.number(),
    run_count: z.number(),
    status: z.string(),
    latest_run: z.object({
      run_id: zid("runs"),
      status: z.string(),
      current_stage: z.string(),
      target_count: z.number(),
      completed_count: z.number(),
      pause_after: RunStageSchema.nullable(),
      current_stage_progress: z.object({
        completed: z.number(),
        failed: z.number(),
        pending: z.number(),
        total: z.number(),
        status: z.string(),
      }),
      stage_counts: z.object({
        rubric_gen: z.number(),
        rubric_critic: z.number(),
        score_gen: z.number(),
        score_critic: z.number(),
      }),
      created_at: z.number(),
      has_failures: z.boolean(),
    }).optional(),
    counts: z.object({
      samples: z.number(),
      rubrics: z.number(),
      rubric_critics: z.number(),
      scores: z.number(),
      score_critics: z.number(),
    }),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.getExperimentSummary,
      args,
    );
  },
});

export const listExperimentEvidence: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ experiment_id: zid("experiments") }),
  returns: z.array(
    z.object({
      evidence_set_item_id: zid("evidence_set_items"),
      evidence_item_id: zid("evidence_items"),
      evidence_view_id: zid("evidence_views").nullable(),
      title: z.string().nullable(),
      url: z.string().nullable(),
      source_name: z.string().nullable(),
      publish_date: z.string().nullable(),
      ordinal: z.number(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.listExperimentEvidence,
      args,
    );
  },
});

export const getRunSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  returns: z.object({
    run_id: zid("runs"),
    status: z.string(),
    current_stage: z.string(),
    pause_after: RunStageSchema.nullable(),
    target_count: z.number(),
    completed_count: z.number(),
    stage_counts: z.object({
      rubric_gen: z.number(),
      rubric_critic: z.number(),
      score_gen: z.number(),
      score_critic: z.number(),
    }),
    has_failures: z.boolean(),
    failed_stage_count: z.number(),
    stages: z.array(z.object({
      stage: z.string(),
      status: z.string(),
      total: z.number(),
      completed: z.number(),
      failed: z.number(),
    })),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(
      internal.domain.runs.experiments_service.getRunSummary,
      args,
    );
  },
});

export const getRunDiagnostics: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.runQuery(internal.domain.runs.run_repo.getRun, {
      run_id,
    });
    const experiment = await ctx.db.get(run.experiment_id) as Doc<"experiments"> | null;
    if (!experiment) {
      throw new Error("Experiment not found");
    }
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const orderedSamples = samples
      .slice()
      .sort((left, right) => left._creationTime - right._creationTime);
    const sampleOrdinalById = new Map(
      orderedSamples.map((sample, index) => [String(sample._id), index] as const),
    );
    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const sampleIdByScoreTargetId = new Map(
      scoreTargets.map((target) => [String(target._id), target.sample_id] as const),
    );
    const attemptRows = await ctx.db
      .query("llm_attempts")
      .withIndex("by_process", (q) =>
        q.eq("process_kind", "run").eq("process_id", run_id),
      )
      .collect();
    const runSummary = await ctx.runQuery(
      internal.domain.runs.experiments_service.getRunSummary,
      { run_id },
    );
    const evidenceSetItems = experiment.evidence_set_id
      ? await ctx.db
        .query("evidence_set_items")
        .withIndex("by_set", (q) => q.eq("evidence_set_id", experiment.evidence_set_id!))
        .collect()
      : [];
    const scoreTargetsPerSample = evidenceSetItems.length > 0
      ? Math.ceil(
        evidenceSetItems.length
          / Math.max(1, experiment.scoring_config.evidence_bundle_size),
      )
      : 0;

    const stageRollup = {
      rubric_gen: { pending: 0, success: 0, error: 0 },
      rubric_critic: { pending: 0, success: 0, error: 0 },
      score_gen: { pending: 0, success: 0, error: 0 },
      score_critic: { pending: 0, success: 0, error: 0 },
    };
    const failed_requests = [] as Array<{
      request_id: Id<"llm_attempts">;
      custom_key: string;
      attempt_index: number | null;
      last_error: string | null;
      status: "pending" | "success" | "error";
      assistant_output_preview: string | null;
    }>;

    const failedAttemptPayloads = new Map<string, string | null>();
    const outputAttemptPayloads = new Map<string, string | null>();
    const attemptsByTargetStage = new Map<string, Array<Doc<"llm_attempts">>>();
    for (const attempt of attemptRows) {
      if (attempt.error_payload_id) {
        const payload = await ctx.db.get(attempt.error_payload_id);
        failedAttemptPayloads.set(String(attempt._id), payload?.content_text ?? null);
      }
      if (attempt.assistant_output_payload_id) {
        const payload = await ctx.db.get(attempt.assistant_output_payload_id);
        outputAttemptPayloads.set(String(attempt._id), payload?.content_text ?? null);
      }
      const current = attemptsByTargetStage.get(
        `${attempt.target_type}:${attempt.target_id}:${attempt.stage}`,
      ) ?? [];
      current.push(attempt);
      attemptsByTargetStage.set(
        `${attempt.target_type}:${attempt.target_id}:${attempt.stage}`,
        current,
      );
    }
    for (const attempts of attemptsByTargetStage.values()) {
      attempts.sort((left, right) => left.started_at_ms - right.started_at_ms);
    }

    const getAttemptStats = (
      targetType: "sample" | "sample_score_target",
      targetId: string,
      stage: "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic",
      fallbackAttemptId: Id<"llm_attempts"> | null | undefined,
    ) => {
      const attempts =
        attemptsByTargetStage.get(`${targetType}:${targetId}:${stage}`) ?? [];
      const attemptCount = attempts.length > 0
        ? attempts.length
        : fallbackAttemptId
          ? 1
          : 0;
      return {
        attempt_count: attemptCount,
        retry_count: Math.max(0, attemptCount - 1),
      };
    }

    for (const attempt of attemptRows) {
      const stage = attempt.stage;
      if (
        stage !== "rubric_gen" &&
        stage !== "rubric_critic" &&
        stage !== "score_gen" &&
        stage !== "score_critic"
      ) {
        continue;
      }
      const normalizedStatus = attempt.status === "started"
        ? "pending"
        : attempt.status === "succeeded"
          ? "success"
          : "error";
      stageRollup[stage][normalizedStatus] += 1;
      if (normalizedStatus === "error") {
        failed_requests.push({
          request_id: attempt._id,
          custom_key: `${attempt.target_type}:${attempt.target_id}:${attempt.stage}`,
          attempt_index: parseAttemptOrdinal(attempt.attempt_key),
          last_error: failedAttemptPayloads.get(String(attempt._id)) ?? null,
          status: "error",
          assistant_output_preview: outputAttemptPayloads.get(String(attempt._id))?.slice(0, 400) ?? null,
        });
      }
    }

    const terminal_failed_targets = [
      ...samples.flatMap((sample) => {
        const rows = [] as Array<{
          sample_id: Id<"samples"> | null;
          sample_ordinal: number | null;
          target_type: "sample";
          target_id: string;
          stage: "rubric_gen" | "rubric_critic";
          custom_key: string;
          attempt_count: number;
          retry_count: number;
          error_class: string | null;
          error_message: string | null;
        }>;
        if (sample.rubric_gen_error_message) {
          const attemptStats = getAttemptStats(
            "sample",
            String(sample._id),
            "rubric_gen",
            sample.rubric_gen_attempt_id,
          );
          rows.push({
            sample_id: sample._id,
            sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? null,
            target_type: "sample",
            target_id: String(sample._id),
            stage: "rubric_gen",
            custom_key: `sample:${sample._id}:rubric_gen`,
            attempt_count: attemptStats.attempt_count,
            retry_count: attemptStats.retry_count,
            error_class: deriveFailureClass(sample.rubric_gen_error_message),
            error_message: sample.rubric_gen_error_message,
          });
        }
        if (sample.rubric_critic_error_message) {
          const attemptStats = getAttemptStats(
            "sample",
            String(sample._id),
            "rubric_critic",
            sample.rubric_critic_attempt_id,
          );
          rows.push({
            sample_id: sample._id,
            sample_ordinal: sampleOrdinalById.get(String(sample._id)) ?? null,
            target_type: "sample",
            target_id: String(sample._id),
            stage: "rubric_critic",
            custom_key: `sample:${sample._id}:rubric_critic`,
            attempt_count: attemptStats.attempt_count,
            retry_count: attemptStats.retry_count,
            error_class: deriveFailureClass(sample.rubric_critic_error_message),
            error_message: sample.rubric_critic_error_message,
          });
        }
        return rows;
      }),
      ...scoreTargets.flatMap((target) => {
        const sampleId = sampleIdByScoreTargetId.get(String(target._id)) ?? null;
        const sampleOrdinal = sampleId
          ? sampleOrdinalById.get(String(sampleId)) ?? null
          : null;
        const rows = [] as Array<{
          sample_id: Id<"samples"> | null;
          sample_ordinal: number | null;
          target_type: "sample_score_target";
          target_id: string;
          stage: "score_gen" | "score_critic";
          custom_key: string;
          attempt_count: number;
          retry_count: number;
          error_class: string | null;
          error_message: string | null;
        }>;
        if (target.score_gen_error_message) {
          const attemptStats = getAttemptStats(
            "sample_score_target",
            String(target._id),
            "score_gen",
            target.score_gen_attempt_id,
          );
          rows.push({
            sample_id: sampleId,
            sample_ordinal: sampleOrdinal,
            target_type: "sample_score_target",
            target_id: String(target._id),
            stage: "score_gen",
            custom_key: `sample_score_target:${target._id}:score_gen`,
            attempt_count: attemptStats.attempt_count,
            retry_count: attemptStats.retry_count,
            error_class: deriveFailureClass(target.score_gen_error_message),
            error_message: target.score_gen_error_message,
          });
        }
        if (target.score_critic_error_message) {
          const attemptStats = getAttemptStats(
            "sample_score_target",
            String(target._id),
            "score_critic",
            target.score_critic_attempt_id,
          );
          rows.push({
            sample_id: sampleId,
            sample_ordinal: sampleOrdinal,
            target_type: "sample_score_target",
            target_id: String(target._id),
            stage: "score_critic",
            custom_key: `sample_score_target:${target._id}:score_critic`,
            attempt_count: attemptStats.attempt_count,
            retry_count: attemptStats.retry_count,
            error_class: deriveFailureClass(target.score_critic_error_message),
            error_message: target.score_critic_error_message,
          });
        }
        return rows;
      }),
    ];

    const terminal_failed_target_summary = Object.entries(
      terminal_failed_targets.reduce<Record<string, { count: number; sample_ordinals: number[] }>>(
        (acc, target) => {
          const current = acc[target.stage] ?? { count: 0, sample_ordinals: [] };
          current.count += 1;
          if (typeof target.sample_ordinal === "number") {
            current.sample_ordinals.push(target.sample_ordinal);
          }
          acc[target.stage] = current;
          return acc;
        },
        {},
      ),
    ).map(([stage, value]) => ({
      stage,
      count: value.count,
      sample_ordinals: value.sample_ordinals.slice().sort((left, right) => left - right),
    }));

    const [rubrics, rubric_critics, scores, score_critics] = await Promise.all([
      ctx.db
        .query("rubrics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("rubric_critics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("scores")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
      ctx.db
        .query("score_critics")
        .withIndex("by_run", (q) => q.eq("run_id", run_id))
        .collect(),
    ]);

    return {
      run_id: run._id,
      experiment_tag: experiment.experiment_tag,
      status: run.status,
      current_stage: run.current_stage,
      target_count: run.target_count,
      score_target_estimate: {
        per_sample: scoreTargetsPerSample,
        total_for_run: scoreTargetsPerSample * run.target_count,
      },
      request_counts: {
        total: attemptRows.length,
        error: terminal_failed_targets.length,
        historical_error: failed_requests.length,
        terminal_failed_targets: terminal_failed_targets.length,
      },
      stage_rollup: stageRollup,
      failed_requests,
      terminal_failed_targets,
      terminal_failed_target_summary,
      terminal_stage_rollup: Object.fromEntries(
        runSummary.stages.map((stage: (typeof runSummary.stages)[number]) => [
          stage.stage,
          {
            completed: stage.completed,
            failed: stage.failed,
            pending: Math.max(0, stage.total - stage.completed - stage.failed),
          },
        ]),
      ),
      artifact_counts: {
        samples: samples.length,
        sample_score_targets: scoreTargets.length,
        rubrics: rubrics.length,
        rubric_critics: rubric_critics.length,
        scores: scores.length,
        score_critics: score_critics.length,
      },
      trace_id: `run:${run._id}`,
    };
  },
});

export const listRunScoreTargets: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ run_id: zid("runs") }),
  returns: z.array(RunScoreTargetListItemSchema),
  handler: async (ctx, { run_id }) => {
    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    return hydrateRunScoreTargets(ctx, scoreTargets);
  },
});

export const listRunScoreTargetsPage: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    run_id: zid("runs"),
    cursor: z.string().nullable().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  returns: z.object({
    items: z.array(RunScoreTargetListItemSchema),
    continue_cursor: z.string().nullable(),
    is_done: z.boolean(),
  }),
  handler: async (ctx, { run_id, cursor, limit }) => {
    const page = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .paginate({
        cursor: cursor ?? null,
        numItems: limit ?? 25,
      });

    return {
      items: await hydrateRunScoreTargets(ctx, page.page),
      continue_cursor: page.continueCursor,
      is_done: page.isDone,
    };
  },
});

export const getTraceEvents: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    trace_id: z.string(),
    cursor_seq: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }),
  handler: async (ctx, args) => {
    return ctx.runQuery(internal.domain.telemetry.events.listByTrace, args);
  },
});
