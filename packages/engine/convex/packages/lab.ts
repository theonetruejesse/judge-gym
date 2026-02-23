import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import { modelTypeSchema, type ModelType } from "../platform/providers/provider_types";
import type { Doc } from "../_generated/dataModel";
import { WindowsTableSchema } from "../models/window";

// todo, clean up this file

const EvidenceWindowInputSchema = WindowsTableSchema.pick({
  query: true,
  country: true,
  start_date: true,
  end_date: true,
  model: true,
});

type EvidenceStatus =
  | "scraping"
  | "cleaning"
  | "neutralizing"
  | "abstracting"
  | "ready";

export const initEvidenceWindow: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_window: EvidenceWindowInputSchema,
  }),
  returns: z.object({
    window_id: zid("windows"),
  }),
  handler: async (ctx, args) => {
    const { evidence_window } = args;
    const window_id = await ctx.runMutation(
      internal.domain.window.window_repo.createWindow,
      {
        country: evidence_window.country,
        start_date: evidence_window.start_date,
        end_date: evidence_window.end_date,
        query: evidence_window.query,
        model: evidence_window.model,
      },
    );

    return {
      window_id,
    };
  },
});

export const initEvidenceWindowAndCollect: ReturnType<typeof zAction> = zAction({
  args: z.object({
    evidence_window: EvidenceWindowInputSchema,
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    window_id: zid("windows"),
    collected: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, { evidence_window, evidence_limit }) => {
    const window_id = await ctx.runMutation(
      internal.domain.window.window_repo.createWindow,
      evidence_window,
    );

    const flowResult = await ctx.runAction(
      internal.domain.window.window_service.startWindowFlow,
      {
        window_id,
        limit: evidence_limit,
      },
    );
    await ctx.runMutation(
      internal.domain.orchestrator.scheduler.startScheduler,
      {},
    );

    return {
      window_id,
      collected: flowResult.inserted,
      total: flowResult.total,
    };
  },
});

export const startWindowFlow: ReturnType<typeof zAction> = zAction({
  args: z.object({
    window_id: zid("windows"),
    evidence_limit: z.number().optional(),
  }),
  returns: z.object({
    inserted: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, args) => {
    const result = await ctx.runAction(
      internal.domain.window.window_service.startWindowFlow,
      {
        window_id: args.window_id,
        limit: args.evidence_limit,
      },
    );
    await ctx.runMutation(
      internal.domain.orchestrator.scheduler.startScheduler,
      {},
    );
    return result;
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
      }),
    ),
  }),
  returns: z.object({
    inserted: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, args) => {
    return ctx.runMutation(
      internal.domain.window.window_repo.insertEvidenceBatch,
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
      query: z.string(),
      model: modelTypeSchema,
      window_tag: z.string(),
      evidence_count: z.number(),
      evidence_status: z.enum([
        "scraping",
        "cleaning",
        "neutralizing",
        "abstracting",
        "ready",
      ]),
    }),
  ),
  handler: async (ctx) => {
    const windows = await ctx.runQuery(
      internal.domain.window.window_repo.listWindows,
      {},
    );
    const results = [] as Array<{
      window_id: string;
      start_date: string;
      end_date: string;
      country: string;
      query: string;
      model: ModelType;
      window_tag: string;
      evidence_count: number;
      evidence_status: EvidenceStatus;
    }>;

    for (const window of windows) {
      const evidences = await ctx.runQuery(
        internal.domain.window.window_repo.listEvidenceByWindow,
        { window_id: window._id },
      );
      const evidence_status = deriveEvidenceStatus(evidences);
      results.push({
        window_id: window._id,
        start_date: window.start_date,
        end_date: window.end_date,
        country: window.country,
        query: window.query,
        model: window.model,
        window_tag: window.window_tag,
        evidence_count: evidences.length,
        evidence_status,
      });
    }

    results.sort((a, b) => a.window_tag.localeCompare(b.window_tag));
    return results;
  },
});

export const listEvidenceByWindow: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_id: zid("windows") }),
  returns: z.array(
    z.object({
      evidence_id: zid("evidences"),
      title: z.string(),
      url: z.string(),
      created_at: z.number(),
    }),
  ),
  handler: async (ctx, { window_id }) => {
    const rows = (await ctx.runQuery(
      internal.domain.window.window_repo.listEvidenceByWindow,
      { window_id },
    )) as Array<Doc<"evidences">>;

    return rows
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((row) => ({
        evidence_id: row._id,
        title: row.title,
        url: row.url,
        created_at: row._creationTime,
      }));
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
  handler: async (ctx, { evidence_id }) => {
    const evidence = await ctx.runQuery(
      internal.domain.window.window_repo.getEvidence,
      { evidence_id },
    );
    if (!evidence) return null;
    return {
      evidence_id: evidence._id,
      window_id: evidence.window_id,
      title: evidence.title,
      url: evidence.url,
      raw_content: evidence.l0_raw_content,
      cleaned_content: evidence.l1_cleaned_content ?? undefined,
      neutralized_content: evidence.l2_neutralized_content ?? undefined,
      abstracted_content: evidence.l3_abstracted_content ?? undefined,
    };
  },
});

export const getWindowSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({ window_id: zid("windows") }),
  returns: z
    .object({
      window_id: zid("windows"),
      status: z.string(),
      current_stage: z.string(),
      window_tag: z.string(),
      model: modelTypeSchema,
      query: z.string(),
      country: z.string(),
      start_date: z.string(),
      end_date: z.string(),
    })
    .nullable(),
  handler: async (ctx, { window_id }) => {
    let window: {
      _id: string;
      status: string;
      current_stage: string;
      window_tag: string;
      model: ModelType;
      query: string;
      country: string;
      start_date: string;
      end_date: string;
    } | null = null;
    try {
      window = await ctx.runQuery(
        internal.domain.window.window_repo.getWindow,
        { window_id },
      );
    } catch (error) {
      return null;
    }
    if (!window) return null;
    return {
      window_id: window._id,
      status: window.status,
      current_stage: window.current_stage,
      window_tag: window.window_tag,
      model: window.model,
      query: window.query,
      country: window.country,
      start_date: window.start_date,
      end_date: window.end_date,
    };
  },
});

export const startScheduler: ReturnType<typeof zMutation> = zMutation({
  args: z.object({}),
  returns: z.object({ ok: z.boolean() }),
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.domain.orchestrator.scheduler.startScheduler,
      {},
    );
    return { ok: true };
  },
});

// change this to handle the permanent failure cases
function deriveEvidenceStatus(
  evidences: Array<{
    l1_cleaned_content: string | null;
    l2_neutralized_content: string | null;
    l3_abstracted_content: string | null;
  }>,
): EvidenceStatus {
  if (evidences.length === 0) return "scraping";
  if (evidences.some((e) => e.l1_cleaned_content === null)) return "cleaning";
  if (evidences.some((e) => e.l2_neutralized_content === null)) return "neutralizing";
  if (evidences.some((e) => e.l3_abstracted_content === null)) return "abstracting";
  return "ready";
}
