"use node";

import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import {
  EvidenceCleaner,
  Neutralizer,
  StructuralAbstractor,
} from "./evidence_agent";

// --- Clean evidence (strip boilerplate) ---
export const cleanBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidence")) }),
  handler: async (ctx, { evidenceIds }) => {
    const cleaner = new EvidenceCleaner();

    for (const evidenceId of evidenceIds) {
      const evidence = await ctx.runQuery(internal.repo.getEvidence, {
        evidenceId,
      });
      const cleaned = await cleaner.clean(ctx, evidence.rawContent);
      await ctx.runMutation(internal.repo.patchEvidence, {
        evidenceId,
        cleanedContent: cleaned,
      });
    }
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
      const input = evidence.cleanedContent ?? evidence.rawContent;
      const neutralized = await neutralizer.neutralize(ctx, input);
      await ctx.runMutation(internal.repo.patchEvidence, {
        evidenceId,
        neutralizedContent: neutralized,
      });
    }
  },
});

// --- Structural abstraction (entity anonymization) ---
export const abstractBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidence")) }),
  handler: async (ctx, { evidenceIds }) => {
    const abstractor = new StructuralAbstractor();

    for (const evidenceId of evidenceIds) {
      const evidence = await ctx.runQuery(internal.repo.getEvidence, {
        evidenceId,
      });
      const input =
        evidence.neutralizedContent ??
        evidence.cleanedContent ??
        evidence.rawContent;
      const abstracted = await abstractor.abstract(ctx, input);
      await ctx.runMutation(internal.repo.patchEvidence, {
        evidenceId,
        abstractedContent: abstracted,
      });
    }
  },
});

// --- Load pre-curated benchmark evidence ---
export const loadBenchmarkEvidence = zInternalAction({
  args: z.object({ windowId: zid("windows") }),
  handler: async (ctx, { windowId }): Promise<number> => {
    const window = await ctx.runQuery(internal.repo.getWindow, { windowId });
    const concept = window.concept;
    // Load from Convex file storage — dataset uploaded during setup
    // Implementation depends on how benchmark data is stored
    // Returns count of evidence items loaded
    throw new Error("TODO: implement benchmark evidence loading");
  },
});
