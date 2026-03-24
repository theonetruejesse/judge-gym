import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zInternalQuery, zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx } from "../_generated/server";
import { RunsTableSchema, RunStageSchema } from "../models/experiments";
import { emitTraceEvent } from "../domain/telemetry/emit";
import { ProcessSnapshotSchema } from "../domain/temporal/schemas";
import {
  LlmAttemptPayloadKindSchema,
  LlmAttemptStatusSchema,
} from "../models/attempts";
import { modelTypeSchema, providerTypeSchema } from "@judge-gym/engine-settings/provider";
import {
  buildRubricCriticPrompt,
  buildRubricGenPrompt,
  buildScoreCriticPrompt,
  buildScoreCriticVerdictSummary,
  buildScoreGenPrompt,
  normalizeExperimentConfig,
  resolveRandomizationStrategy,
  resolveScaleStrategy,
  type ExperimentConfig,
} from "@judge-gym/engine-prompts/run";
import {
  parseExpertAgreementResponse,
  parseQualityResponse,
  parseRubricResponse,
  parseScoreResponse,
} from "../domain/runs/run_parsers";
import { generateLabelMapping } from "../utils/randomize";
import { syncExperimentTotalCount } from "../domain/runs/experiment_progress";
import { incrementSampleScoreCounter } from "../domain/runs/sample_progress";

const RunStageInputSchema = RunStageSchema;

function stableHash(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(index);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

function mapExecutionStatus(status: z.infer<typeof ProcessSnapshotSchema>["executionStatus"]): Doc<"runs">["status"] {
  switch (status) {
    case "failed":
      return "error";
    default:
      return status;
  }
}

function processIdFromSnapshot(
  snapshot: z.infer<typeof ProcessSnapshotSchema>,
): string {
  if (snapshot.processId) {
    return snapshot.processId;
  }

  const [kind, ...rest] = snapshot.workflowId.split(":");
  const inferredProcessId = rest.join(":");
  if (
    inferredProcessId
    && (kind === snapshot.processKind || kind === snapshot.workflowType.toLowerCase().replace("workflow", ""))
  ) {
    return inferredProcessId;
  }

  throw new Error(
    `Process snapshot is missing processId and workflowId ${snapshot.workflowId} could not be normalized.`,
  );
}

function mapRunStage(
  stage: string | null | undefined,
): Doc<"runs">["current_stage"] {
  if (
    stage === "rubric_gen"
    || stage === "rubric_critic"
    || stage === "score_gen"
    || stage === "score_critic"
  ) {
    return stage;
  }
  return "rubric_gen";
}

async function emitSkippedProcessProjection(
  ctx: MutationCtx,
  args: z.infer<typeof ProcessSnapshotSchema>,
  process_id: string,
  reason: "run_missing",
) {
  await emitTraceEvent(ctx, {
    trace_id: `${args.processKind}:${process_id}`,
    entity_type: args.processKind,
    entity_id: process_id,
    event_name: "process_projection_skipped_missing_target",
    status: "error",
    stage: args.stage ?? "rubric_gen",
    payload_json: JSON.stringify({
      reason,
      execution_status: args.executionStatus,
      stage_status: args.stageStatus,
      pause_after: args.pauseAfter,
      last_control_command_id: args.lastControlCommandId,
      workflow_id: args.workflowId,
      workflow_run_id: args.workflowRunId,
      last_error_message: args.lastErrorMessage ?? null,
    }),
  });
}

async function emitSkippedRunStageCallback(
  ctx: MutationCtx,
  args: {
    run_id: Id<"runs">;
    target_id: string;
    stage: z.infer<typeof RunStageInputSchema>;
    attempt_id: Id<"llm_attempts">;
    error_message?: string;
  },
  event_name:
    | "run_stage_result_skipped_missing_target"
    | "run_stage_failure_skipped_missing_target",
  reason:
    | "run_missing"
    | "sample_missing"
    | "score_target_missing"
    | "rubric_missing",
) {
  await emitTraceEvent(ctx, {
    trace_id: `run:${args.run_id}`,
    entity_type: "run",
    entity_id: String(args.run_id),
    event_name,
    status: "error",
    stage: args.stage,
    payload_json: JSON.stringify({
      reason,
      target_id: args.target_id,
      attempt_id: args.attempt_id,
      error_message: args.error_message ?? null,
    }),
  });
}

function runStageFields(stage: z.infer<typeof RunStageInputSchema>) {
  switch (stage) {
    case "rubric_gen":
      return {
        targetType: "sample" as const,
        attemptField: "rubric_gen_attempt_id" as const,
        errorField: "rubric_gen_error_message" as const,
        outputField: "rubric_id" as const,
      };
    case "rubric_critic":
      return {
        targetType: "sample" as const,
        attemptField: "rubric_critic_attempt_id" as const,
        errorField: "rubric_critic_error_message" as const,
        outputField: "rubric_critic_id" as const,
      };
    case "score_gen":
      return {
        targetType: "sample_score_target" as const,
        attemptField: "score_gen_attempt_id" as const,
        errorField: "score_gen_error_message" as const,
        outputField: "score_id" as const,
      };
    case "score_critic":
      return {
        targetType: "sample_score_target" as const,
        attemptField: "score_critic_attempt_id" as const,
        errorField: "score_critic_error_message" as const,
        outputField: "score_critic_id" as const,
      };
  }
}

function buildBlockedStageFailureMessage(args: {
  blockedStage: z.infer<typeof RunStageInputSchema>;
  dependencyStage: z.infer<typeof RunStageInputSchema>;
  dependencyTargetId: string;
}) {
  return [
    `Blocked ${args.blockedStage} because ${args.dependencyStage}`,
    `failed for target ${args.dependencyTargetId}.`,
  ].join(" ");
}

async function markSampleStageBlocked(
  ctx: MutationCtx,
  sampleId: Id<"samples">,
  stage: z.infer<typeof RunStageInputSchema>,
  errorMessage: string,
) {
  const sample = await ctx.db.get(sampleId);
  if (!sample) return false;
  const fields = runStageFields(stage);
  if ((sample as any)[fields.outputField] || (sample as any)[fields.errorField]) {
    return false;
  }
  await ctx.db.patch(sampleId, {
    [fields.errorField]: errorMessage,
  } as Partial<Doc<"samples">>);
  return true;
}

async function markScoreTargetStageBlocked(
  ctx: MutationCtx,
  targetId: Id<"sample_score_targets">,
  stage: z.infer<typeof RunStageInputSchema>,
  errorMessage: string,
) {
  const target = await ctx.db.get(targetId);
  if (!target) return false;
  const fields = runStageFields(stage);
  if ((target as any)[fields.outputField] || (target as any)[fields.errorField]) {
    return false;
  }
  await ctx.db.patch(targetId, {
    [fields.errorField]: errorMessage,
  } as Partial<Doc<"sample_score_targets">>);
  return true;
}

async function markDependentRunWorkBlocked(
  ctx: MutationCtx,
  args: {
    run_id: Id<"runs">;
    stage: z.infer<typeof RunStageInputSchema>;
    target_id: string;
  },
) {
  switch (args.stage) {
    case "rubric_gen": {
      const sampleId = args.target_id as Id<"samples">;
      const blockedByRubricGen = buildBlockedStageFailureMessage({
        blockedStage: "rubric_critic",
        dependencyStage: "rubric_gen",
        dependencyTargetId: args.target_id,
      });
      await markSampleStageBlocked(ctx, sampleId, "rubric_critic", blockedByRubricGen);

      const sampleTargets = await ctx.db
        .query("sample_score_targets")
        .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
        .collect();
      for (const sampleTarget of sampleTargets) {
        await markScoreTargetStageBlocked(
          ctx,
          sampleTarget._id,
          "score_gen",
          buildBlockedStageFailureMessage({
            blockedStage: "score_gen",
            dependencyStage: "rubric_gen",
            dependencyTargetId: args.target_id,
          }),
        );
        await markScoreTargetStageBlocked(
          ctx,
          sampleTarget._id,
          "score_critic",
          buildBlockedStageFailureMessage({
            blockedStage: "score_critic",
            dependencyStage: "rubric_gen",
            dependencyTargetId: args.target_id,
          }),
        );
      }
      return;
    }
    case "rubric_critic": {
      const sampleId = args.target_id as Id<"samples">;
      const sampleTargets = await ctx.db
        .query("sample_score_targets")
        .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
        .collect();
      for (const sampleTarget of sampleTargets) {
        await markScoreTargetStageBlocked(
          ctx,
          sampleTarget._id,
          "score_gen",
          buildBlockedStageFailureMessage({
            blockedStage: "score_gen",
            dependencyStage: "rubric_critic",
            dependencyTargetId: args.target_id,
          }),
        );
        await markScoreTargetStageBlocked(
          ctx,
          sampleTarget._id,
          "score_critic",
          buildBlockedStageFailureMessage({
            blockedStage: "score_critic",
            dependencyStage: "rubric_critic",
            dependencyTargetId: args.target_id,
          }),
        );
      }
      return;
    }
    case "score_gen": {
      await markScoreTargetStageBlocked(
        ctx,
        args.target_id as Id<"sample_score_targets">,
        "score_critic",
        buildBlockedStageFailureMessage({
          blockedStage: "score_critic",
          dependencyStage: "score_gen",
          dependencyTargetId: args.target_id,
        }),
      );
      return;
    }
    case "score_critic":
      return;
  }
}

function buildRunLabelMapping(
  config: ExperimentConfig,
  scaleSize: number,
  seed: number,
): Record<string, number> {
  const randomization = resolveRandomizationStrategy(config);
  const scale = resolveScaleStrategy(config);
  if (randomization.anonLabel) {
    return generateLabelMapping(scaleSize, seed);
  }
  const mapping: Record<string, number> = {};
  scale.letterLabels.forEach((label, idx) => {
    mapping[label] = idx + 1;
  });
  return mapping;
}

function renderBundledEvidence(
  items: Array<{ content: string }>,
) {
  return {
    l0_raw_content: items.map(({ content }, index) => {
      return [`EVIDENCE ${index + 1}`, content].join("\n");
    }).join("\n\n"),
    l1_cleaned_content: items.map(({ content }, index) => {
      return [`EVIDENCE ${index + 1}`, content].join("\n");
    }).join("\n\n"),
    l2_neutralized_content: items.map(({ content }, index) => {
      return [`EVIDENCE ${index + 1}`, content].join("\n");
    }).join("\n\n"),
    l3_abstracted_content: items.map(({ content }, index) => {
      return [`EVIDENCE ${index + 1}`, content].join("\n");
    }).join("\n\n"),
    selected_content: items.map(({ content }, index) => {
      return [`EVIDENCE ${index + 1}`, content].join("\n");
    }).join("\n\n"),
  };
}

const RunStageInputResultSchema = z.array(z.object({
  target_type: z.enum(["sample", "sample_score_target"]),
  target_id: z.string(),
  model: modelTypeSchema,
  system_prompt: z.string(),
  user_prompt: z.string(),
  metadata_json: z.string().nullable(),
}));

type RunStageInputResult = z.infer<typeof RunStageInputResultSchema>;

type RunScoreStageTargetSeed = {
  target_id: string;
  sample_id: Id<"samples">;
  model: Doc<"samples">["model"];
  sample_seed: number;
  rubric: {
    stages: Array<{ label: string; criteria: string[] }>;
    label_mapping: Record<string, number>;
  };
  score: {
    score_id: Id<"scores">;
    decoded_scores: number[];
  } | null;
  items: Array<{
    position: number;
    evidence_item_id: Id<"evidence_items">;
    evidence_view_id: Id<"evidence_views"> | null;
    content_asset_id: Id<"evidence_assets">;
  }>;
};

async function readStoredTextAsset(
  ctx: ActionCtx,
  storageId: string,
) {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error(`Storage asset URL not available for ${storageId}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch storage asset ${storageId}: ${response.status}`);
  }
  return response.text();
}

async function getRunStageProgressDirect(
  ctx: MutationCtx,
  run_id: Id<"runs">,
  stage: z.infer<typeof RunStageInputSchema>,
) {
  if (stage === "rubric_gen" || stage === "rubric_critic") {
    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", run_id))
      .collect();
    const completed = samples.filter((sample: Doc<"samples">) =>
      stage === "rubric_gen"
        ? sample.rubric_id != null
        : sample.rubric_critic_id != null
    ).length;
    const failed = samples.filter((sample: Doc<"samples">) =>
      stage === "rubric_gen"
        ? sample.rubric_id == null && sample.rubric_gen_error_message != null
        : sample.rubric_critic_id == null && sample.rubric_critic_error_message != null
    ).length;
    return {
      total: samples.length,
      completed,
      failed,
      hasPending: completed + failed < samples.length,
    };
  }

  const scoreTargets = await ctx.db
    .query("sample_score_targets")
    .withIndex("by_run", (q) => q.eq("run_id", run_id))
    .collect();
  const completed = scoreTargets.filter((target: Doc<"sample_score_targets">) =>
    stage === "score_gen"
      ? target.score_id != null
      : target.score_critic_id != null
  ).length;
  const failed = scoreTargets.filter((target: Doc<"sample_score_targets">) =>
    stage === "score_gen"
      ? target.score_id == null && target.score_gen_error_message != null
      : target.score_critic_id == null && target.score_critic_error_message != null
  ).length;
  return {
    total: scoreTargets.length,
    completed,
    failed,
    hasPending: completed + failed < scoreTargets.length,
  };
}

export const getRunExecutionContext = zQuery({
  args: z.object({
    run_id: zid("runs"),
  }),
  returns: z.object({
    run_id: zid("runs"),
    experiment_id: zid("experiments"),
    workflow_id: z.string().nullable(),
    workflow_run_id: z.string().nullable(),
    status: RunsTableSchema.shape.status,
    current_stage: RunsTableSchema.shape.current_stage,
    target_count: RunsTableSchema.shape.target_count,
    completed_count: RunsTableSchema.shape.completed_count,
    pause_after: RunsTableSchema.shape.pause_after,
  }),
  handler: async (ctx, { run_id }) => {
    const run = await ctx.db.get(run_id);
    if (!run) {
      throw new Error("Run not found");
    }
    return {
      run_id,
      experiment_id: run.experiment_id,
      workflow_id: run.workflow_id ?? null,
      workflow_run_id: run.workflow_run_id ?? null,
      status: run.status,
      current_stage: run.current_stage,
      target_count: run.target_count,
      completed_count: run.completed_count,
      pause_after: run.pause_after ?? null,
    };
  },
});

export const bindRunWorkflow = zMutation({
  args: z.object({
    run_id: zid("runs"),
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.run_id, {
      workflow_id: args.workflow_id,
      workflow_run_id: args.workflow_run_id,
      status: "queued",
      current_stage: "rubric_gen",
      last_error_message: null,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${args.run_id}`,
      entity_type: "run",
      entity_id: String(args.run_id),
      event_name: "run_workflow_bound",
      status: "queued",
      stage: "rubric_gen",
      payload_json: JSON.stringify({
        workflow_id: args.workflow_id,
        workflow_run_id: args.workflow_run_id,
      }),
    });
    return null;
  },
});

export const listRunStageInputSeed = zInternalQuery({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageInputSchema,
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      throw new Error("Run not found");
    }
    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) {
      throw new Error("Experiment not found");
    }
    const config = normalizeExperimentConfig(experiment);

    if (args.stage === "rubric_gen" || args.stage === "rubric_critic") {
      const samples = await ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
        .collect();
      const orderedSamples = samples
        .slice()
        .sort((left, right) => left._creationTime - right._creationTime);
      const results: Array<{
        target_type: "sample";
        target_id: string;
        model: Doc<"samples">["model"];
        system_prompt: string;
        user_prompt: string;
        metadata_json: string | null;
      }> = [];

      for (const sample of orderedSamples) {
        if (args.stage === "rubric_gen") {
          if (sample.rubric_id || sample.rubric_gen_error_message) {
            continue;
          }
          const prompt = buildRubricGenPrompt({
            concept: experiment.rubric_config.concept,
            scale_size: experiment.rubric_config.scale_size,
          });
          results.push({
            target_type: "sample",
            target_id: String(sample._id),
            model: experiment.rubric_config.model,
            system_prompt: prompt.system_prompt,
            user_prompt: prompt.user_prompt,
            metadata_json: JSON.stringify({
              sample_id: sample._id,
              concept: experiment.rubric_config.concept,
              scale_size: experiment.rubric_config.scale_size,
            }),
          });
          continue;
        }

        if (!sample.rubric_id || sample.rubric_critic_id || sample.rubric_critic_error_message) {
          continue;
        }
        const rubric = await ctx.db.get(sample.rubric_id);
        if (!rubric) {
          continue;
        }
        const prompt = buildRubricCriticPrompt({
          concept: rubric.concept,
          rubric: {
            stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
          },
        });
        results.push({
          target_type: "sample",
          target_id: String(sample._id),
          model: rubric.model,
          system_prompt: prompt.system_prompt,
          user_prompt: prompt.user_prompt,
          metadata_json: JSON.stringify({
            sample_id: sample._id,
            rubric_id: rubric._id,
          }),
        });
      }

      return {
        kind: "prompt_inputs" as const,
        inputs: results,
      };
    }

    const samples = await ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .collect();
    const samplesById = new Map(
      samples.map((sample) => [String(sample._id), sample] as const),
    );
    const rubrics = await Promise.all(
      samples
        .filter((sample) => sample.rubric_id != null)
        .map((sample) => ctx.db.get(sample.rubric_id!)),
    );
    const rubricById = new Map(
      rubrics
        .filter((rubric): rubric is NonNullable<typeof rubrics[number]> => rubric != null)
        .map((rubric) => [String(rubric._id), rubric] as const),
    );
    const rubricBySampleId = new Map<string, NonNullable<typeof rubrics[number]>>();
    for (const sample of samples) {
      if (!sample.rubric_id) continue;
      const rubric = rubricById.get(String(sample.rubric_id));
      if (rubric) {
        rubricBySampleId.set(String(sample._id), rubric);
      }
    }

    const scoreTargets = await ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .collect();
    const itemRows = await ctx.db
      .query("sample_score_target_items")
      .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
      .collect();
    const itemsByTargetId = new Map<string, Array<{
      position: number;
      evidence_item_id: Id<"evidence_items">;
      evidence_view_id: Id<"evidence_views"> | null;
      content_asset_id: Id<"evidence_assets">;
    }>>();
    for (const item of itemRows) {
      const current = itemsByTargetId.get(String(item.score_target_id)) ?? [];
      current.push({
        position: item.position,
        evidence_item_id: item.evidence_item_id,
        evidence_view_id: item.evidence_view_id ?? null,
        content_asset_id: item.content_asset_id,
      });
      itemsByTargetId.set(String(item.score_target_id), current);
    }
    const scoresByTargetId = new Map(
      (
        await ctx.db
          .query("scores")
          .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
          .collect()
      ).map((score) => [String(score.score_target_id), score] as const),
    );

    const targets: RunScoreStageTargetSeed[] = [];

    for (const target of scoreTargets) {
      const sample = samplesById.get(String(target.sample_id));
      if (!sample || !sample.rubric_id) {
        continue;
      }
      const rubric = rubricBySampleId.get(String(sample._id));
      if (!rubric) {
        continue;
      }
      const items = (itemsByTargetId.get(String(target._id)) ?? [])
        .slice()
        .sort((left, right) => left.position - right.position);
      if (items.length === 0) {
        continue;
      }

      if (args.stage === "score_gen") {
        if (target.score_id || target.score_gen_error_message) {
          continue;
        }
        targets.push({
          target_id: String(target._id),
          sample_id: sample._id,
          model: sample.model,
          sample_seed: sample.seed,
          rubric: {
            stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
            label_mapping: rubric.label_mapping,
          },
          score: null,
          items,
        });
        continue;
      }

      const score = target.score_id
        ? scoresByTargetId.get(String(target._id)) ?? await ctx.db.get(target.score_id)
        : scoresByTargetId.get(String(target._id))
          ?? await ctx.db
            .query("scores")
            .withIndex("by_score_target", (q) => q.eq("score_target_id", target._id))
            .first();
      if (!score || target.score_critic_id || target.score_critic_error_message) {
        continue;
      }
      targets.push({
        target_id: String(target._id),
        sample_id: sample._id,
        model: sample.model,
        sample_seed: sample.seed,
        rubric: {
          stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
          label_mapping: rubric.label_mapping,
        },
        score: {
          score_id: score._id,
          decoded_scores: score.decoded_scores,
        },
        items,
      });
    }

    return {
      kind: "score_stage_seed" as const,
      config,
      targets,
    };
  },
});

export const listRunStageInputs = zAction({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageInputSchema,
  }),
  returns: RunStageInputResultSchema,
  handler: async (ctx, args): Promise<RunStageInputResult> => {
    const seed = await ctx.runQuery(internal.packages.worker.listRunStageInputSeed, args);
    if (seed.kind === "prompt_inputs") {
      return seed.inputs;
    }

    const assetContentCache = new Map<string, Promise<string>>();
    const results: RunStageInputResult = [];

    for (const target of seed.targets) {
      const contents = await Promise.all(
        target.items.map(async (item) => {
          const cacheKey = String(item.content_asset_id);
          let pending = assetContentCache.get(cacheKey);
          if (!pending) {
            const asset = await ctx.runQuery(internal.domain.evidence.evidence_repo.getAsset, {
              asset_id: item.content_asset_id,
            });
            if (!asset) {
              throw new Error(`Evidence asset not found for ${item.content_asset_id}`);
            }
            pending = readStoredTextAsset(ctx, asset.storage_id);
            assetContentCache.set(cacheKey, pending);
          }
          return {
            position: item.position,
            content: await pending,
          };
        }),
      );
      const renderedEvidence = renderBundledEvidence(
        contents
          .slice()
          .sort((left, right) => left.position - right.position)
          .map(({ content }) => ({ content })),
      );

      if (args.stage === "score_gen") {
        const prompt = buildScoreGenPrompt({
          config: seed.config,
          evidence: {
            l0_raw_content: renderedEvidence.l0_raw_content,
            l1_cleaned_content: renderedEvidence.l1_cleaned_content,
            l2_neutralized_content: renderedEvidence.l2_neutralized_content,
            l3_abstracted_content: renderedEvidence.l3_abstracted_content,
          },
          rubric: {
            stages: target.rubric.stages,
          },
          sample: {
            label_mapping: target.rubric.label_mapping,
            display_seed: target.sample_seed,
          },
          evidence_item_count: target.items.length,
        });
        results.push({
          target_type: "sample_score_target",
          target_id: target.target_id,
          model: target.model,
          system_prompt: prompt.system_prompt,
          user_prompt: prompt.user_prompt,
          metadata_json: JSON.stringify({
            sample_id: target.sample_id,
            score_target_id: target.target_id,
            evidence_item_count: target.items.length,
          }),
        });
        continue;
      }

      if (!target.score) {
        continue;
      }
      const prompt = buildScoreCriticPrompt({
        config: seed.config,
        evidence: renderedEvidence.selected_content,
        rubric: {
          stages: target.rubric.stages,
        },
        sample: {
          label_mapping: target.rubric.label_mapping,
          display_seed: target.sample_seed,
        },
        verdict: buildScoreCriticVerdictSummary({
          decoded_scores: target.score.decoded_scores,
          displayed_identifiers_by_stage: target.rubric.label_mapping
            ? Object.entries(target.rubric.label_mapping)
              .sort((left, right) => left[1] - right[1])
              .map(([token]) => token)
            : target.rubric.stages.map((_, index) => String.fromCharCode(65 + index)),
          method: seed.config.scoring_config.method,
        }),
        evidence_item_count: target.items.length,
      });
      results.push({
        target_type: "sample_score_target",
        target_id: target.target_id,
        model: target.model,
        system_prompt: prompt.system_prompt,
        user_prompt: prompt.user_prompt,
        metadata_json: JSON.stringify({
          sample_id: target.sample_id,
          score_target_id: target.target_id,
          score_id: target.score.score_id,
          evidence_item_count: target.items.length,
        }),
      });
    }

    return results;
  },
});

export const projectProcessState = zMutation({
  args: ProcessSnapshotSchema,
  returns: z.null(),
  handler: async (ctx, args) => {
    const process_id = processIdFromSnapshot(args);
    const run_id = process_id as Id<"runs">;
    const run = await ctx.db.get(run_id);
    if (!run) {
      await emitSkippedProcessProjection(ctx, args, process_id, "run_missing");
      return null;
    }

    await ctx.db.patch(run_id, {
      workflow_id: args.workflowId,
      workflow_run_id: args.workflowRunId,
      status: mapExecutionStatus(args.executionStatus),
      current_stage: mapRunStage(args.stage),
      pause_after: (args.pauseAfter as Doc<"runs">["pause_after"]) ?? null,
      last_error_message: args.lastErrorMessage ?? null,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${run_id}`,
      entity_type: "run",
      entity_id: String(run_id),
      event_name: "run_snapshot_projected",
      status: mapExecutionStatus(args.executionStatus),
      stage: args.stage ?? "rubric_gen",
      payload_json: JSON.stringify({
        stage_status: args.stageStatus,
        pause_after: args.pauseAfter,
        last_control_command_id: args.lastControlCommandId,
        stage_history: args.stageHistory,
        workflow_id: args.workflowId,
        workflow_run_id: args.workflowRunId,
      }),
    });
    return null;
  },
});

export const recordLlmAttemptStart = zMutation({
  args: z.object({
    attempt_key: z.string().optional(),
    process_kind: z.enum(["run"]),
    process_id: z.string(),
    target_type: z.enum(["sample", "sample_score_target"]),
    target_id: z.string(),
    stage: z.string(),
    provider: providerTypeSchema,
    model: modelTypeSchema,
    operation_type: z.enum(["chat", "batch"]),
    workflow_id: z.string(),
    system_prompt: z.string(),
    user_prompt: z.string(),
    metadata_json: z.string().nullable().optional(),
  }),
  returns: z.object({
    attempt_id: zid("llm_attempts"),
  }),
  handler: async (ctx, args) => {
    if (args.attempt_key) {
      const existingAttempt = await ctx.db
        .query("llm_attempts")
        .withIndex("by_attempt_key", (q) => q.eq("attempt_key", args.attempt_key!))
        .first();
      if (existingAttempt) {
        return { attempt_id: existingAttempt._id };
      }
    }

    const content_hash = stableHash(args.system_prompt);
    let promptTemplate = await ctx.db
      .query("llm_prompt_templates")
      .withIndex("by_content_hash", (q) => q.eq("content_hash", content_hash))
      .first();

    const prompt_template_id =
      promptTemplate?._id ??
      (await ctx.db.insert("llm_prompt_templates", {
        content_hash,
        content: args.system_prompt,
      }));

    const attempt_id = await ctx.db.insert("llm_attempts", {
      attempt_key: args.attempt_key ?? null,
      process_kind: args.process_kind,
      process_id: args.process_id,
      target_type: args.target_type,
      target_id: args.target_id,
      stage: args.stage,
      provider: args.provider,
      model: args.model,
      operation_type: args.operation_type,
      workflow_id: args.workflow_id,
      prompt_template_id,
      user_prompt_payload_id: null,
      assistant_output_payload_id: null,
      error_payload_id: null,
      status: "started",
      started_at_ms: Date.now(),
      finished_at_ms: null,
      metadata_json: args.metadata_json ?? null,
    });

    const userPromptPayloadId = await ctx.db.insert("llm_attempt_payloads", {
      attempt_id,
      process_kind: args.process_kind,
      process_id: args.process_id,
      kind: "user_prompt",
      content_text: args.user_prompt,
      content_hash: stableHash(args.user_prompt),
      byte_size: new TextEncoder().encode(args.user_prompt).length,
      content_type: "text/plain",
    });

    await ctx.db.patch(attempt_id, {
      user_prompt_payload_id: userPromptPayloadId,
    });

    await emitTraceEvent(ctx, {
      trace_id: `${args.process_kind}:${args.process_id}`,
      entity_type: args.process_kind,
      entity_id: args.process_id,
      event_name: "llm_attempt_started",
      status: "running",
      stage: args.stage,
      payload_json: JSON.stringify({
        attempt_id,
        target_id: args.target_id,
        target_type: args.target_type,
        model: args.model,
        provider: args.provider,
      }),
    });

    return { attempt_id };
  },
});

export const recordLlmAttemptFinish = zMutation({
  args: z.object({
    attempt_id: zid("llm_attempts"),
    status: z.enum(["succeeded", "failed"]),
    assistant_output: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
    input_tokens: z.number().nullable().optional(),
    output_tokens: z.number().nullable().optional(),
    total_tokens: z.number().nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attempt_id);
    if (!attempt) {
      console.warn("worker_record_llm_attempt_finish_missing_attempt", JSON.stringify({
        attempt_id: args.attempt_id,
        status: args.status,
      }));
      return null;
    }

    if (attempt.status !== "started") {
      return null;
    }

    const patch: Partial<Doc<"llm_attempts">> = {
      status: args.status,
      finished_at_ms: Date.now(),
      input_tokens: args.input_tokens ?? null,
      output_tokens: args.output_tokens ?? null,
      total_tokens: args.total_tokens ?? null,
    };

    if (args.status === "succeeded" && args.assistant_output) {
      const payloadId = await ctx.db.insert("llm_attempt_payloads", {
        attempt_id: args.attempt_id,
        process_kind: attempt.process_kind,
        process_id: attempt.process_id,
        kind: "assistant_output",
        content_text: args.assistant_output,
        content_hash: stableHash(args.assistant_output),
        byte_size: new TextEncoder().encode(args.assistant_output).length,
        content_type: "text/plain",
      });
      patch.assistant_output_payload_id = payloadId;
    }

    if (args.status === "failed" && args.error_message) {
      const payloadId = await ctx.db.insert("llm_attempt_payloads", {
        attempt_id: args.attempt_id,
        process_kind: attempt.process_kind,
        process_id: attempt.process_id,
        kind: "error",
        content_text: args.error_message,
        content_hash: stableHash(args.error_message),
        byte_size: new TextEncoder().encode(args.error_message).length,
        content_type: "text/plain",
      });
      patch.error_payload_id = payloadId;
    }

    await ctx.db.patch(args.attempt_id, patch);
    return null;
  },
});

export const recordProcessHeartbeat = zMutation({
  args: z.object({
    process_kind: z.enum(["run"]),
    process_id: z.string(),
    stage: z.string(),
    event_name: z.string().default("stage_activity_heartbeat"),
    payload_json: z.string().nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await emitTraceEvent(ctx, {
      trace_id: `${args.process_kind}:${args.process_id}`,
      entity_type: args.process_kind,
      entity_id: args.process_id,
      event_name: args.event_name,
      status: "running",
      stage: args.stage,
      payload_json: args.payload_json ?? null,
    });
    return null;
  },
});


export const applyRunStageResult = zMutation({
  args: z.object({
    run_id: zid("runs"),
    target_id: z.string(),
    stage: RunStageInputSchema,
    attempt_id: zid("llm_attempts"),
    output: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      await emitSkippedRunStageCallback(
        ctx,
        args,
        "run_stage_result_skipped_missing_target",
        "run_missing",
      );
      return null;
    }
    const experiment = await ctx.db.get(run.experiment_id);
    if (!experiment) {
      throw new Error("Experiment not found");
    }
    const config = normalizeExperimentConfig(experiment);

    if (args.stage === "rubric_gen") {
      const sample = await ctx.db.get(args.target_id as Id<"samples">);
      if (!sample) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "sample_missing",
        );
        return null;
      }
      if (sample.run_id !== args.run_id) {
        throw new Error("Sample not found for run");
      }
      if (sample.rubric_id) {
        return null;
      }
      const parsed = parseRubricResponse(
        args.output,
        experiment.rubric_config.scale_size,
      );
      const label_mapping = buildRunLabelMapping(
        config,
        experiment.rubric_config.scale_size,
        sample.seed,
      );
      const rubric_id = await ctx.db.insert("rubrics", {
        run_id: args.run_id,
        sample_id: sample._id,
        model: experiment.rubric_config.model,
        concept: experiment.rubric_config.concept,
        scale_size: experiment.rubric_config.scale_size,
        llm_attempt_id: args.attempt_id,
        justification: parsed.reasoning,
        stages: parsed.stages,
        label_mapping,
      });
      await ctx.db.patch(sample._id, {
        rubric_id,
        rubric_gen_attempt_id: args.attempt_id,
        rubric_gen_error_message: null,
      });
    }

    if (args.stage === "rubric_critic") {
      const sample = await ctx.db.get(args.target_id as Id<"samples">);
      if (!sample) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "sample_missing",
        );
        return null;
      }
      if (sample.run_id !== args.run_id) {
        throw new Error("Sample not found for run");
      }
      if (sample.rubric_critic_id) {
        return null;
      }
      if (!sample.rubric_id) {
        throw new Error("Rubric missing for sample");
      }
      const rubric = await ctx.db.get(sample.rubric_id);
      if (!rubric) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "rubric_missing",
        );
        return null;
      }
      const parsed = parseQualityResponse(args.output);
      const rubric_critic_id = await ctx.db.insert("rubric_critics", {
        run_id: args.run_id,
        sample_id: sample._id,
        model: rubric.model,
        llm_attempt_id: args.attempt_id,
        justification: parsed.reasoning,
        expert_agreement_prob: {
          observability_score: parsed.observabilityScore,
          discriminability_score: parsed.discriminabilityScore,
        },
      });
      await ctx.db.patch(sample._id, {
        rubric_critic_id,
        rubric_critic_attempt_id: args.attempt_id,
        rubric_critic_error_message: null,
      });
    }

    if (args.stage === "score_gen") {
      const target = await ctx.db.get(args.target_id as Id<"sample_score_targets">);
      if (!target) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "score_target_missing",
        );
        return null;
      }
      if (target.run_id !== args.run_id) {
        throw new Error("Score target not found for run");
      }
      if (target.score_id) {
        return null;
      }
      const sample = await ctx.db.get(target.sample_id);
      if (!sample) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "sample_missing",
        );
        return null;
      }
      if (!sample.rubric_id) {
        throw new Error("Rubric missing for sample");
      }
      const rubric = await ctx.db.get(sample.rubric_id);
      if (!rubric) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "rubric_missing",
        );
        return null;
      }
      const parsedVerdict = parseScoreResponse(args.output, {
        parserKey: config.output_contract?.parser_key ?? "single_verdict",
        labelMapping: rubric.label_mapping,
        method: config.scoring_config.method,
      });
      const score_id = await ctx.db.insert("scores", {
        run_id: args.run_id,
        sample_id: sample._id,
        score_target_id: target._id,
        model: sample.model,
        llm_attempt_id: args.attempt_id,
        justification: parsedVerdict.reasoning,
        decoded_scores: parsedVerdict.decodedScores ?? [],
      });
      await ctx.db.patch(target._id, {
        score_id,
        score_gen_attempt_id: args.attempt_id,
        score_gen_error_message: null,
      });
      await incrementSampleScoreCounter(ctx, sample._id, "score_count");
    }

    if (args.stage === "score_critic") {
      const target = await ctx.db.get(args.target_id as Id<"sample_score_targets">);
      if (!target) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "score_target_missing",
        );
        return null;
      }
      if (target.run_id !== args.run_id) {
        throw new Error("Score target not found for run");
      }
      if (target.score_critic_id) {
        return null;
      }
      const sample = await ctx.db.get(target.sample_id);
      if (!sample) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_result_skipped_missing_target",
          "sample_missing",
        );
        return null;
      }
      const parsed = parseExpertAgreementResponse(args.output);
      const score_critic_id = await ctx.db.insert("score_critics", {
        run_id: args.run_id,
        sample_id: sample._id,
        score_target_id: target._id,
        model: sample.model,
        llm_attempt_id: args.attempt_id,
        justification: parsed.reasoning,
        expert_agreement_prob: parsed.expertAgreementProb,
      });
      await ctx.db.patch(target._id, {
        score_critic_id,
        score_critic_attempt_id: args.attempt_id,
        score_critic_error_message: null,
      });
      await incrementSampleScoreCounter(ctx, sample._id, "score_critic_count");
    }

    await emitTraceEvent(ctx, {
      trace_id: `run:${args.run_id}`,
      entity_type: "run",
      entity_id: String(args.run_id),
      event_name: "run_stage_result_applied",
      status: "running",
      stage: args.stage,
      payload_json: JSON.stringify({
        target_id: args.target_id,
        attempt_id: args.attempt_id,
      }),
    });
    return null;
  },
});

export const markRunStageFailure = zMutation({
  args: z.object({
    run_id: zid("runs"),
    target_id: z.string(),
    stage: RunStageInputSchema,
    attempt_id: zid("llm_attempts"),
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const fields = runStageFields(args.stage);
    if (fields.targetType === "sample") {
      const sample = await ctx.db.get(args.target_id as Id<"samples">);
      if (!sample) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_failure_skipped_missing_target",
          "sample_missing",
        );
        return null;
      }
      if (sample.run_id !== args.run_id) {
        throw new Error("Sample not found for run");
      }
      if ((sample as any)[fields.outputField]) {
        return null;
      }
      await ctx.db.patch(sample._id, {
        [fields.attemptField]: args.attempt_id,
        [fields.errorField]: args.error_message,
      } as Partial<Doc<"samples">>);
    } else {
      const target = await ctx.db.get(args.target_id as Id<"sample_score_targets">);
      if (!target) {
        await emitSkippedRunStageCallback(
          ctx,
          args,
          "run_stage_failure_skipped_missing_target",
          "score_target_missing",
        );
        return null;
      }
      if (target.run_id !== args.run_id) {
        throw new Error("Score target not found for run");
      }
      if ((target as any)[fields.outputField]) {
        return null;
      }
      await ctx.db.patch(target._id, {
        [fields.attemptField]: args.attempt_id,
        [fields.errorField]: args.error_message,
      } as Partial<Doc<"sample_score_targets">>);
    }

    await markDependentRunWorkBlocked(ctx, {
      run_id: args.run_id,
      stage: args.stage,
      target_id: args.target_id,
    });

    await emitTraceEvent(ctx, {
      trace_id: `run:${args.run_id}`,
      entity_type: "run",
      entity_id: String(args.run_id),
      event_name: "run_stage_attempt_failed",
      status: "error",
      stage: args.stage,
      payload_json: JSON.stringify({
        target_id: args.target_id,
        attempt_id: args.attempt_id,
        error_message: args.error_message,
      }),
    });
    return null;
  },
});

export const finalizeRunStage = zMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageInputSchema,
  }),
  returns: z.object({
    total: z.number(),
    completed: z.number(),
    failed: z.number(),
    has_pending: z.boolean(),
    halt_process: z.boolean(),
    terminal_execution_status: z.enum(["completed", "failed", "canceled"]).nullable(),
    error_message: z.string().nullable(),
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.run_id);
    if (!run) {
      throw new Error("Run not found");
    }
    const progress = await getRunStageProgressDirect(ctx, args.run_id, args.stage);
    const stageCountField = `${args.stage}_count` as const;
    if ((run as any)[stageCountField] !== progress.completed) {
      await ctx.db.patch(args.run_id, {
        [stageCountField]: progress.completed,
      } as Partial<Doc<"runs">>);
    }

    if (args.stage === "score_critic" && !progress.hasPending) {
      const samples = await ctx.db
        .query("samples")
        .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
        .collect();
      const completed_count = samples.filter((sample) =>
        sample.score_target_total > 0
        && (sample.score_critic_count ?? 0) >= sample.score_target_total
      ).length;
      await ctx.db.patch(args.run_id, {
        completed_count,
      });
      await syncExperimentTotalCount(ctx, run.experiment_id);
    }

    if (progress.failed > 0 && progress.completed === 0 && !progress.hasPending) {
      const error_message =
        `Run ${args.run_id} failed in stage ${args.stage} with ${progress.failed} failed target(s)`;
      await ctx.db.patch(args.run_id, {
        status: "error",
        current_stage: args.stage,
        last_error_message: error_message,
      });
      await emitTraceEvent(ctx, {
        trace_id: `run:${args.run_id}`,
        entity_type: "run",
        entity_id: String(args.run_id),
        event_name: "run_process_failed",
        status: "error",
        stage: args.stage,
        payload_json: JSON.stringify({
          completed: progress.completed,
          failed: progress.failed,
          total: progress.total,
        }),
      });
      return {
        ...progress,
        has_pending: progress.hasPending,
        halt_process: true,
        terminal_execution_status: "failed" as const,
        error_message,
      };
    }

    return {
      ...progress,
      has_pending: progress.hasPending,
      halt_process: false,
      terminal_execution_status: null,
      error_message: null,
    };
  },
});

export const markRunProcessError = zMutation({
  args: z.object({
    run_id: zid("runs"),
    stage: RunStageSchema.nullable(),
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.run_id, {
      status: "error",
      current_stage: args.stage ?? "rubric_gen",
      last_error_message: args.error_message,
    });
    await emitTraceEvent(ctx, {
      trace_id: `run:${args.run_id}`,
      entity_type: "run",
      entity_id: String(args.run_id),
      event_name: "run_process_failed",
      status: "error",
      stage: args.stage ?? "rubric_gen",
      payload_json: JSON.stringify({
        error_message: args.error_message,
      }),
    });
    return null;
  },
});

export const getBatchExecution = zQuery({
  args: z.object({
    batch_key: z.string(),
  }),
  returns: z.object({
    batch_execution_id: zid("llm_batch_executions"),
    provider_batch_id: z.string().nullable(),
    status: z.string(),
    output_file_id: z.string().nullable().optional(),
    error_file_id: z.string().nullable().optional(),
    provider_artifacts_json: z.string().nullable().optional(),
    attempt_recorded_count: z.number().nullable().optional(),
    attempt_records_json: z.string().nullable().optional(),
  }).nullable(),
  handler: async (ctx, args) => {
    const execution = await ctx.db
      .query("llm_batch_executions")
      .withIndex("by_batch_key", (q) => q.eq("batch_key", args.batch_key))
      .first();
    if (!execution) {
      return null;
    }
    return {
      batch_execution_id: execution._id,
      provider_batch_id: execution.provider_batch_id ?? null,
      status: execution.status,
      output_file_id: execution.output_file_id ?? null,
      error_file_id: execution.error_file_id ?? null,
      provider_artifacts_json: execution.provider_artifacts_json ?? null,
      attempt_recorded_count: execution.attempt_recorded_count ?? null,
      attempt_records_json: execution.attempt_records_json ?? null,
    };
  },
});

export const ensureBatchExecution = zMutation({
  args: z.object({
    batch_key: z.string(),
    process_kind: z.enum(["run"]),
    process_id: z.string(),
    stage: z.string(),
    provider: z.string(),
    model: z.string(),
    workflow_id: z.string(),
    item_count: z.number(),
  }),
  returns: z.object({
    batch_execution_id: zid("llm_batch_executions"),
    provider_batch_id: z.string().nullable(),
    status: z.string(),
    output_file_id: z.string().nullable().optional(),
    error_file_id: z.string().nullable().optional(),
    provider_artifacts_json: z.string().nullable().optional(),
    attempt_recorded_count: z.number().nullable().optional(),
    attempt_records_json: z.string().nullable().optional(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("llm_batch_executions")
      .withIndex("by_batch_key", (q) => q.eq("batch_key", args.batch_key))
      .first();
    if (existing) {
      return {
        batch_execution_id: existing._id,
        provider_batch_id: existing.provider_batch_id ?? null,
        status: existing.status,
        output_file_id: existing.output_file_id ?? null,
        error_file_id: existing.error_file_id ?? null,
        attempt_recorded_count: existing.attempt_recorded_count ?? null,
        attempt_records_json: existing.attempt_records_json ?? null,
      };
    }

    const batch_execution_id = await ctx.db.insert("llm_batch_executions", {
      batch_key: args.batch_key,
      process_kind: args.process_kind,
      process_id: args.process_id,
      stage: args.stage,
      provider: args.provider,
      model: args.model,
      workflow_id: args.workflow_id,
      item_count: args.item_count,
      provider_batch_id: null,
      input_file_id: null,
      output_file_id: null,
      error_file_id: null,
      provider_artifacts_json: null,
      status: "preparing",
      last_known_provider_status: null,
      last_error_message: null,
      attempt_recorded_count: 0,
      attempt_records_json: null,
      submitted_at_ms: null,
      completed_at_ms: null,
    });

    return {
      batch_execution_id,
      provider_batch_id: null,
      status: "preparing",
      output_file_id: null,
      error_file_id: null,
      provider_artifacts_json: null,
      attempt_recorded_count: 0,
      attempt_records_json: null,
    };
  },
});

export const recordBatchExecutionPreparationProgress = zMutation({
  args: z.object({
    batch_execution_id: zid("llm_batch_executions"),
    attempt_recorded_count: z.number().int().min(0),
    attempt_records_json: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.batch_execution_id);
    if (!execution) {
      throw new Error("Batch execution not found");
    }
    const currentCount = execution.attempt_recorded_count ?? 0;
    if (args.attempt_recorded_count < currentCount) {
      return null;
    }
    await ctx.db.patch(args.batch_execution_id, {
      attempt_recorded_count: args.attempt_recorded_count,
      attempt_records_json: args.attempt_records_json,
      last_error_message: null,
    });
    return null;
  },
});

export const bindBatchExecutionSubmitted = zMutation({
  args: z.object({
    batch_execution_id: zid("llm_batch_executions"),
    provider_batch_id: z.string(),
    input_file_id: z.string().nullable().optional(),
    provider_status: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.batch_execution_id);
    if (!execution) {
      throw new Error("Batch execution not found");
    }
    if (
      execution.provider_batch_id
      && execution.provider_batch_id !== args.provider_batch_id
    ) {
      throw new Error("Batch execution already bound to a different provider batch id");
    }
    await ctx.db.patch(args.batch_execution_id, {
      provider_batch_id: args.provider_batch_id,
      input_file_id: args.input_file_id ?? execution.input_file_id ?? null,
      status: "submitted",
      last_known_provider_status: args.provider_status,
      submitted_at_ms: execution.submitted_at_ms ?? Date.now(),
      last_error_message: null,
    });
    return null;
  },
});

export const finalizeBatchExecution = zMutation({
  args: z.object({
    batch_execution_id: zid("llm_batch_executions"),
    status: z.enum(["submitted", "completed", "failed", "cancelled"]),
    provider_status: z.string(),
    output_file_id: z.string().nullable().optional(),
    error_file_id: z.string().nullable().optional(),
    provider_artifacts_json: z.string().nullable().optional(),
    error_message: z.string().nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.batch_execution_id);
    if (!execution) {
      throw new Error("Batch execution not found");
    }
    await ctx.db.patch(args.batch_execution_id, {
      status: args.status,
      last_known_provider_status: args.provider_status,
      output_file_id: args.output_file_id ?? execution.output_file_id ?? null,
      error_file_id: args.error_file_id ?? execution.error_file_id ?? null,
      provider_artifacts_json:
        args.provider_artifacts_json
        ?? execution.provider_artifacts_json
        ?? null,
      last_error_message: args.error_message ?? null,
      completed_at_ms:
        args.status === "completed" || args.status === "failed" || args.status === "cancelled"
          ? (execution.completed_at_ms ?? Date.now())
          : execution.completed_at_ms ?? null,
    });
    return null;
  },
});

export const reserveQuota = zMutation({
  args: z.object({
    reservationId: z.string(),
    provider: z.string(),
    model: z.string().optional(),
    operationType: z.string(),
    scopeKey: z.string(),
    dimensions: z.object({
      requests: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      batch_enqueued_input_tokens: z.number().optional(),
    }),
    processKind: z.enum(["run"]).optional(),
    processId: z.string().optional(),
    workflowId: z.string().optional(),
  }),
  returns: z.object({
    allowed: z.boolean(),
    reservationId: z.string(),
    bucketKeys: z.array(z.string()),
    dimensions: z.object({
      requests: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      batch_enqueued_input_tokens: z.number().optional(),
    }),
    reason: z.string().optional(),
  }),
  handler: async (_ctx, args) => {
    return {
      allowed: true,
      reservationId: args.reservationId,
      bucketKeys: [],
      dimensions: args.dimensions,
      reason: "convex_quota_passthrough",
    };
  },
});

export const settleQuota = zMutation({
  args: z.object({
    reservationId: z.string(),
    provider: z.string(),
    model: z.string().optional(),
    operationType: z.string(),
    scopeKey: z.string(),
    reserved: z.object({
      requests: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      batch_enqueued_input_tokens: z.number().optional(),
    }),
    observed: z.object({
      requests: z.number().optional(),
      input_tokens: z.number().optional(),
      output_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
      batch_enqueued_input_tokens: z.number().optional(),
    }).optional(),
    status: z.enum(["applied", "refunded", "failed"]),
  }),
  returns: z.null(),
  handler: async () => null,
});
