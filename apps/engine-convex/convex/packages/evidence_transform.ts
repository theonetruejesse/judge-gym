import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { buildEvidenceTransformPrompt } from "@judge-gym/engine-prompts";
import {
  EvidenceTransformStageKeySchema,
  type EvidenceTransformStageKey,
} from "@judge-gym/engine-settings/process";
import { modelTypeSchema } from "@judge-gym/engine-settings/provider";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { zAction, zMutation, zQuery } from "../utils/custom_fns";

type EvidenceTransformRunDoc = Doc<"evidence_transform_runs">;
type EvidenceSetItemDoc = Doc<"evidence_set_items">;
type EvidenceSourceRecordDoc = Doc<"evidence_source_records">;
type EvidenceViewDoc = Doc<"evidence_views">;

type QueryLikeCtx = {
  runQuery: any;
};
type MutationLikeCtx = QueryLikeCtx & {
  runMutation: any;
};
type ActionLikeCtx = MutationLikeCtx & {
  runAction: any;
  storage: {
    getUrl: (storageId: string) => Promise<string | null>;
  };
};

const SOURCE_RECORD_KIND_SCHEMA = z.enum(["source_text", "paper_original"]);
const SOURCE_RECORD_KINDS = ["source_text", "paper_original"] as const;
const TRANSFORM_STAGE_KEYS = ["l1_cleaned", "l2_neutralized", "l3_abstracted"] as const;

const EvidenceTransformRunSummarySchema = z.object({
  evidence_transform_run_id: zid("evidence_transform_runs"),
  evidence_set_id: zid("evidence_sets"),
  source_record_kind: SOURCE_RECORD_KIND_SCHEMA,
  target_view_kinds: z.array(EvidenceTransformStageKeySchema),
  model: modelTypeSchema,
  prompt_version: z.string(),
  status: z.string(),
  workflow_id: z.string().nullable(),
  workflow_run_id: z.string().nullable(),
  current_stage: EvidenceTransformStageKeySchema.nullable(),
  total_count: z.number(),
  completed_count: z.number(),
  failed_count: z.number(),
  last_error_message: z.string().nullable(),
  started_at_ms: z.number().nullable(),
  finished_at_ms: z.number().nullable(),
  created_at_ms: z.number(),
});

const EvidenceTransformUniverseRunSummarySchema = EvidenceTransformRunSummarySchema.extend({
  evidence_set_tag: z.string(),
  evidence_set_title: z.string(),
  evidence_set_quality_label: z.string(),
});

const EvidenceSetTransformCoverageSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  evidence_set_tag: z.string(),
  title: z.string(),
  quality_label: z.string(),
  item_count: z.number(),
  source_record_coverage: z.array(z.object({
    record_kind: SOURCE_RECORD_KIND_SCHEMA,
    available_count: z.number(),
    missing_count: z.number(),
  })),
  view_coverage: z.array(z.object({
    view_kind: EvidenceTransformStageKeySchema,
    completed_count: z.number(),
    error_count: z.number(),
    pending_count: z.number(),
  })),
});

const TransformStageInputSchema = z.object({
  evidence_set_item_id: zid("evidence_set_items"),
  evidence_item_id: zid("evidence_items"),
  model: modelTypeSchema,
  stage: EvidenceTransformStageKeySchema,
  system_prompt: z.string(),
  user_prompt: z.string(),
  metadata_json: z.string().nullable(),
});

type TransformStageInput = z.infer<typeof TransformStageInputSchema>;

function canonicalStageIndex(stage: EvidenceTransformStageKey) {
  switch (stage) {
    case "l1_cleaned":
      return 0;
    case "l2_neutralized":
      return 1;
    case "l3_abstracted":
      return 2;
  }
}

function parseViewText(output: string) {
  const marker = "VIEW_TEXT:";
  const markerIndex = output.indexOf(marker);
  const content = markerIndex >= 0
    ? output.slice(markerIndex + marker.length).trim()
    : output.trim();
  if (content.length === 0) {
    throw new Error("Transform output did not contain a VIEW_TEXT block.");
  }
  return content;
}

async function readStorageText(
  ctx: { storage: { getUrl: (storageId: string) => Promise<string | null> } },
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

async function requireTransformRun(
  ctx: QueryLikeCtx,
  evidence_transform_run_id: Id<"evidence_transform_runs">,
): Promise<EvidenceTransformRunDoc> {
  const run: EvidenceTransformRunDoc | null = await ctx.runQuery(
    internal.domain.evidence.evidence_repo.getEvidenceTransformRun,
    {
      evidence_transform_run_id,
    },
  );
  if (!run) {
    throw new Error("Evidence transform run not found.");
  }
  return run;
}

function summarizeRun(run: EvidenceTransformRunDoc): z.infer<typeof EvidenceTransformRunSummarySchema> {
  return {
    evidence_transform_run_id: run._id,
    evidence_set_id: run.evidence_set_id,
    source_record_kind: run.source_record_kind,
    target_view_kinds: run.target_view_kinds,
    model: run.model,
    prompt_version: run.prompt_version,
    status: run.status,
    workflow_id: run.workflow_id ?? null,
    workflow_run_id: run.workflow_run_id ?? null,
    current_stage: run.current_stage ?? null,
    total_count: run.total_count,
    completed_count: run.completed_count,
    failed_count: run.failed_count,
    last_error_message: run.last_error_message ?? null,
    started_at_ms: run.started_at_ms ?? null,
    finished_at_ms: run.finished_at_ms ?? null,
    created_at_ms: run.created_at_ms,
  };
}

async function getOrderedSetItems(
  ctx: QueryLikeCtx,
  evidence_set_id: Id<"evidence_sets">,
): Promise<EvidenceSetItemDoc[]> {
  const setItems: EvidenceSetItemDoc[] = await ctx.runQuery(
    internal.domain.evidence.evidence_repo.listEvidenceSetItems,
    {
      evidence_set_id,
    },
  );
  return setItems
    .slice()
    .sort((left: EvidenceSetItemDoc, right: EvidenceSetItemDoc) =>
      left.ordinal - right.ordinal || left._creationTime - right._creationTime
    );
}

async function getSelectedSourceRecord(args: {
  ctx: QueryLikeCtx;
  setItem: EvidenceSetItemDoc;
  run: EvidenceTransformRunDoc;
}): Promise<EvidenceSourceRecordDoc> {
  const sourceRecords: EvidenceSourceRecordDoc[] = await args.ctx.runQuery(
    internal.domain.evidence.evidence_repo.listItemSourceRecords,
    {
      evidence_item_id: args.setItem.evidence_item_id,
    },
  );
  const selected = args.setItem.pinned_source_record_id
    ? sourceRecords.find(
      (record: EvidenceSourceRecordDoc) => record._id === args.setItem.pinned_source_record_id,
    ) ?? null
    : sourceRecords.find(
      (record: EvidenceSourceRecordDoc) => record.record_kind === args.run.source_record_kind,
    ) ?? sourceRecords.find((record: EvidenceSourceRecordDoc) => record.is_primary) ?? null;
  if (!selected) {
    throw new Error(`Missing source record for evidence item ${args.setItem.evidence_item_id}`);
  }
  return selected;
}

async function getDependencyView(args: {
  ctx: QueryLikeCtx;
  evidence_item_id: Id<"evidence_items">;
  dependencyStage: EvidenceTransformStageKey;
}): Promise<EvidenceViewDoc> {
  const views: EvidenceViewDoc[] = await args.ctx.runQuery(
    internal.domain.evidence.evidence_repo.listItemViews,
    {
      evidence_item_id: args.evidence_item_id,
    },
  );
  const dependency = views.find(
    (view: EvidenceViewDoc) =>
      view.view_kind === args.dependencyStage && view.status === "completed" && view.asset_id != null,
  ) ?? null;
  if (!dependency?.asset_id) {
    throw new Error(
      `Missing dependency view ${args.dependencyStage} for evidence item ${args.evidence_item_id}`,
    );
  }
  return dependency;
}

export const createEvidenceTransformRun: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
    source_record_kind: SOURCE_RECORD_KIND_SCHEMA.default("source_text"),
    target_view_kinds: z.array(EvidenceTransformStageKeySchema).min(1),
    model: modelTypeSchema,
    prompt_version: z.string().default("semantic-transform-v1"),
  }),
  returns: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
  }),
  handler: async (ctx, args): Promise<{ evidence_transform_run_id: Id<"evidence_transform_runs"> }> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.createEvidenceTransformRun, args);
  },
});

export const getEvidenceTransformRun: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
  }),
  returns: EvidenceTransformRunSummarySchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceTransformRunSummarySchema>> => {
    return summarizeRun(
      await requireTransformRun(ctx as unknown as QueryLikeCtx, args.evidence_transform_run_id),
    );
  },
});

export const listEvidenceTransformRuns: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  returns: z.array(EvidenceTransformUniverseRunSummarySchema),
  handler: async (ctx, args): Promise<Array<z.infer<typeof EvidenceTransformUniverseRunSummarySchema>>> => {
    const evidenceSets = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.listUniverseEvidenceSets,
      {
        universe_id: args.universe_id,
      },
    );

    const runs: Array<z.infer<typeof EvidenceTransformUniverseRunSummarySchema>> = [];
    for (const evidenceSet of evidenceSets) {
      const setRuns: EvidenceTransformRunDoc[] = await ctx.db
        .query("evidence_transform_runs")
        .withIndex("by_evidence_set", (q) => q.eq("evidence_set_id", evidenceSet._id))
        .collect();
      for (const run of setRuns) {
        runs.push({
          ...summarizeRun(run),
          evidence_set_tag: evidenceSet.evidence_set_tag,
          evidence_set_title: evidenceSet.title,
          evidence_set_quality_label: evidenceSet.quality_label,
        });
      }
    }

    return runs
      .slice()
      .sort((left, right) => right.created_at_ms - left.created_at_ms);
  },
});

export const getEvidenceSetTransformCoverage: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  returns: EvidenceSetTransformCoverageSchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceSetTransformCoverageSchema>> => {
    const evidenceSet = await ctx.db.get(args.evidence_set_id);
    if (!evidenceSet) {
      throw new Error("Evidence set not found.");
    }

    const setItems = await getOrderedSetItems(ctx as unknown as QueryLikeCtx, args.evidence_set_id);
    const uniqueItemIds = Array.from(
      new Set(setItems.map((item) => String(item.evidence_item_id))),
    ) as Array<Id<"evidence_items">>;

    const sourceRecordCounts = new Map<string, number>();
    const completedViewCounts = new Map<string, number>();
    const errorViewCounts = new Map<string, number>();

    for (const evidenceItemId of uniqueItemIds) {
      const [sourceRecords, views] = await Promise.all([
        ctx.runQuery(internal.domain.evidence.evidence_repo.listItemSourceRecords, {
          evidence_item_id: evidenceItemId,
        }) as Promise<EvidenceSourceRecordDoc[]>,
        ctx.runQuery(internal.domain.evidence.evidence_repo.listItemViews, {
          evidence_item_id: evidenceItemId,
        }) as Promise<EvidenceViewDoc[]>,
      ]);

      for (const recordKind of SOURCE_RECORD_KINDS) {
        if (sourceRecords.some((record) => record.record_kind === recordKind)) {
          sourceRecordCounts.set(recordKind, (sourceRecordCounts.get(recordKind) ?? 0) + 1);
        }
      }

      for (const stage of TRANSFORM_STAGE_KEYS) {
        const view = views.find((candidate) => candidate.view_kind === stage) ?? null;
        if (!view) {
          continue;
        }
        if (view.status === "completed" && view.asset_id != null) {
          completedViewCounts.set(stage, (completedViewCounts.get(stage) ?? 0) + 1);
        } else if (view.status === "error") {
          errorViewCounts.set(stage, (errorViewCounts.get(stage) ?? 0) + 1);
        }
      }
    }

    const itemCount = uniqueItemIds.length;

    return {
      evidence_set_id: evidenceSet._id,
      evidence_set_tag: evidenceSet.evidence_set_tag,
      title: evidenceSet.title,
      quality_label: evidenceSet.quality_label,
      item_count: itemCount,
      source_record_coverage: SOURCE_RECORD_KINDS.map((recordKind) => {
        const available_count = sourceRecordCounts.get(recordKind) ?? 0;
        return {
          record_kind: recordKind,
          available_count,
          missing_count: Math.max(0, itemCount - available_count),
        };
      }),
      view_coverage: TRANSFORM_STAGE_KEYS.map((viewKind) => {
        const completed_count = completedViewCounts.get(viewKind) ?? 0;
        const error_count = errorViewCounts.get(viewKind) ?? 0;
        return {
          view_kind: viewKind,
          completed_count,
          error_count,
          pending_count: Math.max(0, itemCount - completed_count - error_count),
        };
      }),
    };
  },
});

export const startEvidenceTransformRun: ReturnType<typeof zAction> = zAction({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
  }),
  returns: z.object({
    workflow_id: z.string(),
    workflow_run_id: z.string(),
  }),
  handler: async (ctx, args): Promise<{ workflow_id: string; workflow_run_id: string; }> => {
    const run = await requireTransformRun(
      ctx as unknown as QueryLikeCtx,
      args.evidence_transform_run_id,
    );
    const started = await ctx.runAction(
      internal.domain.temporal.temporal_client.startEvidenceTransformWorkflow,
      {
        evidence_transform_run_id: args.evidence_transform_run_id,
        stages: run.target_view_kinds,
      },
    );
    await ctx.runMutation(internal.domain.evidence.evidence_repo.patchEvidenceTransformRun, {
      evidence_transform_run_id: args.evidence_transform_run_id,
      status: "queued",
      workflow_id: started.workflow_id,
      workflow_run_id: started.workflow_run_id,
      started_at_ms: Date.now(),
    });
    return started;
  },
});

export const getEvidenceTransformRunExecutionContext: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
  }),
  returns: EvidenceTransformRunSummarySchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceTransformRunSummarySchema>> => {
    return summarizeRun(
      await requireTransformRun(ctx as unknown as QueryLikeCtx, args.evidence_transform_run_id),
    );
  },
});

export const markEvidenceTransformStageRunning: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    stage: EvidenceTransformStageKeySchema,
  }),
  returns: z.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireTransformRun(ctx as unknown as QueryLikeCtx, args.evidence_transform_run_id);
    await ctx.runMutation(internal.domain.evidence.evidence_repo.patchEvidenceTransformRun, {
      evidence_transform_run_id: args.evidence_transform_run_id,
      status: "running",
      current_stage: args.stage,
      last_error_message: null,
    });
    return null;
  },
});

export const listEvidenceTransformStageInputs: ReturnType<typeof zAction> = zAction({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    stage: EvidenceTransformStageKeySchema,
  }),
  returns: z.array(TransformStageInputSchema),
  handler: async (ctx, args): Promise<TransformStageInput[]> => {
    const run = await requireTransformRun(
      ctx as unknown as QueryLikeCtx,
      args.evidence_transform_run_id,
    );
    if (!run.target_view_kinds.includes(args.stage)) {
      return [];
    }

    const orderedSetItems = await getOrderedSetItems(
      ctx as unknown as QueryLikeCtx,
      run.evidence_set_id,
    );
    const inputs: TransformStageInput[] = [];

    for (const setItem of orderedSetItems) {
      const views: EvidenceViewDoc[] = await ctx.runQuery(
        internal.domain.evidence.evidence_repo.listItemViews,
        {
          evidence_item_id: setItem.evidence_item_id,
        },
      );
      const completedView = views.find(
        (view: EvidenceViewDoc) =>
          view.view_kind === args.stage && view.status === "completed" && view.asset_id != null,
      );
      if (completedView) {
        continue;
      }

      const sourceAssetId = args.stage === "l1_cleaned"
        ? (await getSelectedSourceRecord({
          ctx: ctx as unknown as QueryLikeCtx,
          setItem,
          run,
        })).asset_id
        : (await getDependencyView({
          ctx: ctx as unknown as QueryLikeCtx,
          evidence_item_id: setItem.evidence_item_id,
          dependencyStage: args.stage === "l2_neutralized" ? "l1_cleaned" : "l2_neutralized",
        })).asset_id!;

      const asset: Doc<"evidence_assets"> | null = await ctx.runQuery(
        internal.domain.evidence.evidence_repo.getAsset,
        {
          asset_id: sourceAssetId,
        },
      );
      if (!asset) {
        throw new Error(`Missing evidence asset ${sourceAssetId}`);
      }
      const sourceText = await readStorageText(ctx, asset.storage_id);
      const prompt = buildEvidenceTransformPrompt({
        stage: args.stage,
        sourceText,
      });
      inputs.push({
        evidence_set_item_id: setItem._id,
        evidence_item_id: setItem.evidence_item_id,
        model: run.model,
        stage: args.stage,
        system_prompt: prompt.system_prompt,
        user_prompt: prompt.user_prompt,
        metadata_json: JSON.stringify({
          evidence_transform_run_id: args.evidence_transform_run_id,
          evidence_set_item_id: setItem._id,
          evidence_item_id: setItem.evidence_item_id,
          stage: args.stage,
        }),
      });
    }

    return inputs;
  },
});

export const applyEvidenceTransformStageResult: ReturnType<typeof zAction> = zAction({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    evidence_item_id: zid("evidence_items"),
    stage: EvidenceTransformStageKeySchema,
    output: z.string(),
  }),
  returns: z.object({
    evidence_view_id: zid("evidence_views"),
  }),
  handler: async (ctx, args): Promise<{ evidence_view_id: Id<"evidence_views"> }> => {
    const run = await requireTransformRun(
      ctx as unknown as QueryLikeCtx,
      args.evidence_transform_run_id,
    );
    const viewText = parseViewText(args.output);
    const storedAsset: { asset_id: Id<"evidence_assets"> } = await ctx.runAction(
      internal.domain.evidence.evidence_service.storeTextAsset,
      {
      content: viewText,
      role: "view_text",
      mime_type: "text/plain",
      encoding: "utf-8",
      },
    );
    return ctx.runMutation(internal.domain.evidence.evidence_repo.upsertView, {
      evidence_item_id: args.evidence_item_id,
      view_kind: args.stage,
      pipeline_kind: "semantic_transform",
      pipeline_version: run.prompt_version,
      asset_id: storedAsset.asset_id,
      status: "completed",
      metadata_json: JSON.stringify({
        evidence_transform_run_id: args.evidence_transform_run_id,
        stage: args.stage,
        model: run.model,
      }),
    });
  },
});

export const markEvidenceTransformStageFailure: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    evidence_item_id: zid("evidence_items"),
    stage: EvidenceTransformStageKeySchema,
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args): Promise<null> => {
    const run = await requireTransformRun(
      ctx as unknown as QueryLikeCtx,
      args.evidence_transform_run_id,
    );
    await ctx.runMutation(internal.domain.evidence.evidence_repo.upsertView, {
      evidence_item_id: args.evidence_item_id,
      view_kind: args.stage,
      pipeline_kind: "semantic_transform",
      pipeline_version: run.prompt_version,
      asset_id: null,
      status: "error",
      metadata_json: JSON.stringify({
        evidence_transform_run_id: args.evidence_transform_run_id,
        stage: args.stage,
        error_message: args.error_message,
      }),
    });
    return null;
  },
});

export const finalizeEvidenceTransformStage: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    stage: EvidenceTransformStageKeySchema,
  }),
  returns: z.object({
    total: z.number(),
    completed: z.number(),
    failed: z.number(),
    has_pending: z.boolean(),
    halt_process: z.boolean(),
    error_message: z.string().nullable(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{
    total: number;
    completed: number;
    failed: number;
    has_pending: boolean;
    halt_process: boolean;
    error_message: string | null;
  }> => {
    const run = await requireTransformRun(
      ctx as unknown as QueryLikeCtx,
      args.evidence_transform_run_id,
    );
    const orderedSetItems = await getOrderedSetItems(
      ctx as unknown as QueryLikeCtx,
      run.evidence_set_id,
    );
    const uniqueItemIds = Array.from(
      new Set(orderedSetItems.map((item: EvidenceSetItemDoc) => String(item.evidence_item_id))),
    ) as Array<string>;

    let completed = 0;
    let failed = 0;
    for (const evidenceItemId of uniqueItemIds) {
      const views: EvidenceViewDoc[] = await ctx.runQuery(
        internal.domain.evidence.evidence_repo.listItemViews,
        {
        evidence_item_id: evidenceItemId as Id<"evidence_items">,
        },
      );
      const match = views.find((view: EvidenceViewDoc) => view.view_kind === args.stage) ?? null;
      if (!match) continue;
      if (match.status === "completed" && match.asset_id != null) completed += 1;
      if (match.status === "error") failed += 1;
    }

    const total = uniqueItemIds.length;
    const has_pending = completed + failed < total;
    const finalStage = run.target_view_kinds
      .slice()
      .sort((left: EvidenceTransformStageKey, right: EvidenceTransformStageKey) =>
        canonicalStageIndex(left) - canonicalStageIndex(right)
      )
      .at(-1) ?? args.stage;
    const done = !has_pending && finalStage === args.stage;
    const errorMessage = done && failed > 0
      ? `${failed} evidence items failed ${args.stage}`
      : null;

    await ctx.runMutation(internal.domain.evidence.evidence_repo.patchEvidenceTransformRun, {
      evidence_transform_run_id: args.evidence_transform_run_id,
      status: done ? (failed > 0 ? "error" : "completed") : "running",
      current_stage: args.stage,
      completed_count: completed,
      failed_count: failed,
      last_error_message: errorMessage,
      finished_at_ms: done ? Date.now() : undefined,
    });

    return {
      total,
      completed,
      failed,
      has_pending,
      halt_process: done,
      error_message: errorMessage,
    };
  },
});

export const markEvidenceTransformRunError: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_transform_run_id: zid("evidence_transform_runs"),
    stage: EvidenceTransformStageKeySchema,
    error_message: z.string(),
  }),
  returns: z.null(),
  handler: async (ctx, args): Promise<null> => {
    await requireTransformRun(ctx as unknown as QueryLikeCtx, args.evidence_transform_run_id);
    await ctx.runMutation(internal.domain.evidence.evidence_repo.patchEvidenceTransformRun, {
      evidence_transform_run_id: args.evidence_transform_run_id,
      status: "error",
      current_stage: args.stage,
      last_error_message: args.error_message,
      finished_at_ms: Date.now(),
    });
    return null;
  },
});
