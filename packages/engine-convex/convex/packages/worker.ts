import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { WindowsTableSchema } from "../models/window";
import { emitTraceEvent } from "../domain/telemetry/emit";
import {
  LlmAttemptPayloadKindSchema,
  LlmAttemptStatusSchema,
} from "../models/attempts";
import { modelTypeSchema, providerTypeSchema } from "../platform/providers/provider_types";

const ProcessSnapshotSchema = z.object({
  processKind: z.enum(["run", "window"]),
  processId: z.string(),
  workflowId: z.string(),
  workflowRunId: z.string(),
  workflowType: z.string(),
  executionStatus: z.enum([
    "queued",
    "running",
    "paused",
    "completed",
    "failed",
    "canceled",
  ]),
  stage: z.string().nullable(),
  stageStatus: z.enum(["pending", "running", "paused", "done", "failed"]),
  pauseAfter: z.string().nullable(),
  stageHistory: z.array(z.string()),
  lastControlCommandId: z.string().nullable(),
  lastErrorMessage: z.string().nullable(),
});

const StageInputSchema = z.enum(["l1_cleaned", "l2_neutralized", "l3_abstracted"]);

function stableHash(content: string): string {
  let hash = 5381;
  for (let index = 0; index < content.length; index += 1) {
    hash = ((hash << 5) + hash) ^ content.charCodeAt(index);
  }
  return `h_${(hash >>> 0).toString(16)}`;
}

function mapWindowStage(stage: string | null | undefined): Doc<"windows">["current_stage"] {
  if (!stage || stage === "collect") {
    return "l0_raw";
  }
  if (stage === "l1_cleaned" || stage === "l2_neutralized" || stage === "l3_abstracted") {
    return stage;
  }
  return "l0_raw";
}

function mapExecutionStatus(status: z.infer<typeof ProcessSnapshotSchema>["executionStatus"]): Doc<"windows">["status"] {
  switch (status) {
    case "failed":
      return "error";
    default:
      return status;
  }
}

function windowStageFields(stage: z.infer<typeof StageInputSchema>) {
  switch (stage) {
    case "l1_cleaned":
      return {
        inputField: "l0_raw_content" as const,
        outputField: "l1_cleaned_content" as const,
        attemptField: "l1_attempt_id" as const,
        errorField: "l1_error_message" as const,
      };
    case "l2_neutralized":
      return {
        inputField: "l1_cleaned_content" as const,
        outputField: "l2_neutralized_content" as const,
        attemptField: "l2_attempt_id" as const,
        errorField: "l2_error_message" as const,
      };
    case "l3_abstracted":
      return {
        inputField: "l2_neutralized_content" as const,
        outputField: "l3_abstracted_content" as const,
        attemptField: "l3_attempt_id" as const,
        errorField: "l3_error_message" as const,
      };
  }
}

export const getWindowExecutionContext = zQuery({
  args: z.object({
    window_id: zid("windows"),
  }),
  returns: z.object({
    window_id: zid("windows"),
    workflow_id: z.string().nullable(),
    workflow_run_id: z.string().nullable(),
    status: WindowsTableSchema.shape.status,
    current_stage: WindowsTableSchema.shape.current_stage,
    target_count: WindowsTableSchema.shape.target_count,
    completed_count: WindowsTableSchema.shape.completed_count,
    model: WindowsTableSchema.shape.model,
    start_date: WindowsTableSchema.shape.start_date,
    end_date: WindowsTableSchema.shape.end_date,
    country: WindowsTableSchema.shape.country,
    query: WindowsTableSchema.shape.query,
  }),
  handler: async (ctx, { window_id }) => {
    const window = await ctx.db.get(window_id);
    if (!window) {
      throw new Error("Window not found");
    }
    return {
      window_id,
      workflow_id: window.workflow_id ?? null,
      workflow_run_id: window.workflow_run_id ?? null,
      status: window.status,
      current_stage: window.current_stage,
      target_count: window.target_count,
      completed_count: window.completed_count,
      model: window.model,
      start_date: window.start_date,
      end_date: window.end_date,
      country: window.country,
      query: window.query,
    };
  },
});

export const bindWindowWorkflow = zMutation({
  args: z.object({
    window_id: zid("windows"),
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.window_id, {
      workflow_id: args.workflow_id,
      workflow_run_id: args.workflow_run_id,
      status: "queued",
      last_error_message: null,
    });
    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_workflow_bound",
      status: "queued",
      stage: "l0_raw",
      payload_json: JSON.stringify({
        workflow_id: args.workflow_id,
        workflow_run_id: args.workflow_run_id,
      }),
    });
    return null;
  },
});

export const projectProcessState = zMutation({
  args: ProcessSnapshotSchema,
  returns: z.null(),
  handler: async (ctx, args) => {
    if (args.processKind !== "window") {
      return null;
    }

    const window_id = args.processId as Id<"windows">;
    const window = await ctx.db.get(window_id);
    if (!window) {
      throw new Error("Window not found");
    }

    await ctx.db.patch(window_id, {
      workflow_id: args.workflowId,
      workflow_run_id: args.workflowRunId,
      status: mapExecutionStatus(args.executionStatus),
      current_stage: mapWindowStage(args.stage),
      last_error_message: args.lastErrorMessage ?? null,
    });
    await emitTraceEvent(ctx, {
      trace_id: `window:${window_id}`,
      entity_type: "window",
      entity_id: String(window_id),
      event_name: "window_snapshot_projected",
      status: mapExecutionStatus(args.executionStatus),
      stage: args.stage ?? "l0_raw",
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

export const insertWindowEvidenceBatch = zMutation({
  args: z.object({
    window_id: zid("windows"),
    evidences: z.array(z.object({
      title: z.string(),
      url: z.string(),
      raw_content: z.string(),
    })),
  }),
  returns: z.object({
    inserted: z.number(),
    total: z.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    inserted: number;
    total: number;
  }> => {
    const result: {
      inserted: number;
      total: number;
    } = await ctx.runMutation(
      internal.domain.window.window_repo.insertEvidenceBatch,
      args,
    );
    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_evidence_collected",
      status: "running",
      stage: "collect",
      payload_json: JSON.stringify(result),
    });
    return result;
  },
});

export const listWindowStageInputs = zQuery({
  args: z.object({
    window_id: zid("windows"),
    stage: StageInputSchema,
  }),
  returns: z.array(z.object({
    evidence_id: zid("evidences"),
    title: z.string(),
    url: z.string(),
    input: z.string(),
  })),
  handler: async (ctx, args) => {
    const fields = windowStageFields(args.stage);
    const evidences = await ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", args.window_id))
      .collect();

    return evidences.flatMap((evidence) => {
      const input = evidence[fields.inputField];
      if (typeof input !== "string" || input.length === 0) {
        return [];
      }
      if (evidence[fields.outputField] !== null) {
        return [];
      }
      if (evidence[fields.errorField] !== null && evidence[fields.errorField] !== undefined) {
        return [];
      }
      return [{
        evidence_id: evidence._id,
        title: evidence.title,
        url: evidence.url,
        input,
      }];
    });
  },
});

export const recordLlmAttemptStart = zMutation({
  args: z.object({
    process_kind: z.enum(["window", "run"]),
    process_id: z.string(),
    target_type: z.enum(["evidence", "sample", "sample_score_target"]),
    target_id: z.string(),
    stage: z.string(),
    provider: providerTypeSchema,
    model: modelTypeSchema,
    operation_type: z.enum(["chat", "batch", "search"]),
    workflow_id: z.string(),
    system_prompt: z.string(),
    user_prompt: z.string(),
    metadata_json: z.string().nullable().optional(),
  }),
  returns: z.object({
    attempt_id: zid("llm_attempts"),
  }),
  handler: async (ctx, args) => {
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
      throw new Error("Attempt not found");
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

export const applyWindowStageResult = zMutation({
  args: z.object({
    window_id: zid("windows"),
    evidence_id: zid("evidences"),
    stage: StageInputSchema,
    attempt_id: zid("llm_attempts"),
    output: z.string(),
    input_tokens: z.number().nullable().optional(),
    output_tokens: z.number().nullable().optional(),
    total_tokens: z.number().nullable().optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const fields = windowStageFields(args.stage);
    const evidence = await ctx.db.get(args.evidence_id);
    if (!evidence || evidence.window_id !== args.window_id) {
      throw new Error("Evidence not found for window");
    }

    await ctx.db.patch(args.evidence_id, {
      [fields.outputField]: args.output,
      [fields.attemptField]: args.attempt_id,
      [fields.errorField]: null,
    } as Partial<Doc<"evidences">>);

    if (args.stage === "l3_abstracted") {
      const window = await ctx.db.get(args.window_id);
      if (window) {
        await ctx.db.patch(args.window_id, {
          completed_count: Math.min(
            window.target_count,
            (window.completed_count ?? 0) + 1,
          ),
        });
      }
    }

    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_stage_result_applied",
      status: "running",
      stage: args.stage,
      payload_json: JSON.stringify({
        evidence_id: args.evidence_id,
        attempt_id: args.attempt_id,
        input_tokens: args.input_tokens ?? null,
        output_tokens: args.output_tokens ?? null,
        total_tokens: args.total_tokens ?? null,
      }),
    });
    return null;
  },
});

export const markWindowStageFailure = zMutation({
  args: z.object({
    window_id: zid("windows"),
    evidence_id: zid("evidences"),
    stage: StageInputSchema,
    attempt_id: zid("llm_attempts"),
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const fields = windowStageFields(args.stage);
    const evidence = await ctx.db.get(args.evidence_id);
    if (!evidence || evidence.window_id !== args.window_id) {
      throw new Error("Evidence not found for window");
    }

    await ctx.db.patch(args.evidence_id, {
      [fields.attemptField]: args.attempt_id,
      [fields.errorField]: args.error_message,
    } as Partial<Doc<"evidences">>);

    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_stage_attempt_failed",
      status: "error",
      stage: args.stage,
      payload_json: JSON.stringify({
        evidence_id: args.evidence_id,
        attempt_id: args.attempt_id,
        error_message: args.error_message,
      }),
    });
    return null;
  },
});

export const markWindowNoEvidence = zMutation({
  args: z.object({
    window_id: zid("windows"),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.window_id, {
      status: "completed",
      current_stage: "l0_raw",
      target_count: 0,
      completed_count: 0,
      last_error_message: null,
    });
    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_completed_no_evidence",
      status: "completed",
      stage: "l0_raw",
    });
    return null;
  },
});

export const markWindowProcessError = zMutation({
  args: z.object({
    window_id: zid("windows"),
    stage: z.string().nullable(),
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.window_id, {
      status: "error",
      current_stage: mapWindowStage(args.stage),
      last_error_message: args.error_message,
    });
    await emitTraceEvent(ctx, {
      trace_id: `window:${args.window_id}`,
      entity_type: "window",
      entity_id: String(args.window_id),
      event_name: "window_process_failed",
      status: "error",
      stage: args.stage ?? "l0_raw",
      payload_json: JSON.stringify({
        error_message: args.error_message,
      }),
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
    processKind: z.enum(["window", "run"]).optional(),
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
