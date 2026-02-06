"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import FirecrawlApp from "@mendable/firecrawl-js";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { Neutralizer } from "./evidence_agent";

// --- Scrape news via Firecrawl ---
export const scrapeNews = zInternalAction({
  args: z.object({
    windowId: zid("windows"),
    concept: z.string(),
    country: z.string(),
    limit: z.number(),
  }),
  handler: async (
    ctx,
    { windowId, concept, country, limit },
  ): Promise<Id<"evidence">[]> => {
    const firecrawl = new FirecrawlApp({
      apiKey: process.env.FIRECRAWL_API_KEY!,
    });

    const results = await firecrawl.search(`${concept} ${country} news`, {
      limit,
      scrapeOptions: { formats: ["markdown"] },
    });

    // Firecrawl v4 returns results under .data or .news depending on source
    const items = (results as any).data ?? (results as any).news ?? [];
    const ids: Id<"evidence">[] = [];
    for (const result of items) {
      const id = await ctx.runMutation(internal.repo.createEvidence, {
        windowId,
        title: result.metadata?.title ?? result.url ?? "Untitled",
        url: result.url ?? "",
        rawContent: result.markdown ?? "",
        neutralizedContent: undefined,
      });
      ids.push(id);
    }
    return ids;
  },
});

// --- Neutralize evidence (tone removal) ---
export const neutralizeBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidence")) }),
  handler: async (ctx, { evidenceIds }) => {
    const neutralizer = new Neutralizer();

    for (const evidenceId of evidenceIds) {
      const evidence = await ctx.runQuery(internal.repo.getEvidence, {
        evidenceId,
      });
      const neutralized = await neutralizer.neutralize(
        ctx,
        evidence.rawContent,
      );
      await ctx.runMutation(internal.repo.patchEvidence, {
        evidenceId,
        neutralizedContent: neutralized,
      });
    }
  },
});

// --- Load pre-curated benchmark evidence ---
export const loadBenchmarkEvidence = zInternalAction({
  args: z.object({ windowId: zid("windows"), concept: z.string() }),
  handler: async (ctx, { windowId, concept }): Promise<number> => {
    // Load from Convex file storage — dataset uploaded during setup
    // Implementation depends on how benchmark data is stored
    // Returns count of evidence items loaded
    throw new Error("TODO: implement benchmark evidence loading");
  },
});
