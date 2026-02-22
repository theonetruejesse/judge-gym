import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zMutation, zQuery } from "../utils/custom_fns";
import { api, internal } from "../_generated/api";
import { modelTypeSchema, type ModelType } from "../platform/providers/provider_types";

const EvidenceWindowInputSchema = z.object({
  concept: z.string().min(1),
  country: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  model_id: modelTypeSchema,
});

type EvidenceWindowInput = z.infer<typeof EvidenceWindowInputSchema>;

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
    reused_window: z.boolean(),
  }),
  handler: async (ctx, args) => {
    const { evidence_window } = args;
    const existing = await ctx.db
      .query("windows")
      .filter((q) =>
        q.and(
          q.eq("country", evidence_window.country),
          q.eq("start_date", evidence_window.start_date),
          q.eq("end_date", evidence_window.end_date),
          q.eq("query", evidence_window.concept),
          q.eq("model", evidence_window.model_id as ModelType),
        ),
      )
      .first();

    if (existing) {
      return {
        window_id: existing._id,
        reused_window: true,
      };
    }

    const window_id = await ctx.runMutation(
      internal.domain.window.window_repo.createWindow,
      {
        country: evidence_window.country,
        start_date: evidence_window.start_date,
        end_date: evidence_window.end_date,
        query: evidence_window.concept,
        model: evidence_window.model_id,
      },
    );

    return {
      window_id,
      reused_window: false,
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
    reused_window: z.boolean(),
    collected: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, { evidence_window, evidence_limit }) => {
    const initResult = await ctx.runMutation(
      api.packages.lab.initEvidenceWindow,
      { evidence_window },
    );

    const flowResult = await ctx.runAction(
      internal.domain.window.window_service.startWindowFlow,
      {
        window_id: initResult.window_id,
        limit: evidence_limit,
      },
    );

    return {
      window_id: initResult.window_id,
      reused_window: initResult.reused_window,
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
    return ctx.runAction(
      internal.domain.window.window_service.startWindowFlow,
      {
        window_id: args.window_id,
        limit: args.evidence_limit,
      },
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
      concept: z.string(),
      model_id: modelTypeSchema,
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
    const windows = await ctx.db.query("windows").collect();
    const results = [] as Array<{
      window_id: string;
      start_date: string;
      end_date: string;
      country: string;
      concept: string;
      model_id: ModelType;
      window_tag: string;
      evidence_count: number;
      evidence_status: EvidenceStatus;
    }>;

    for (const window of windows) {
      const evidences = await ctx.db
        .query("evidences")
        .withIndex("by_window_id", (q) => q.eq("window_id", window._id))
        .collect();
      const evidence_status = deriveEvidenceStatus(evidences);
      results.push({
        window_id: window._id,
        start_date: window.start_date,
        end_date: window.end_date,
        country: window.country,
        concept: window.query,
        model_id: window.model,
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
    const rows = await ctx.db
      .query("evidences")
      .withIndex("by_window_id", (q) => q.eq("window_id", window_id))
      .collect();

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
    const evidence = await ctx.db.get(evidence_id);
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
      model_id: modelTypeSchema,
      concept: z.string(),
      country: z.string(),
      start_date: z.string(),
      end_date: z.string(),
    })
    .nullable(),
  handler: async (ctx, { window_id }) => {
    const window = await ctx.db.get(window_id);
    if (!window) return null;
    return {
      window_id: window._id,
      status: window.status,
      current_stage: window.current_stage,
      window_tag: window.window_tag,
      model_id: window.model,
      concept: window.query,
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
