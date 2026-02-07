import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";

const DEFAULT_LIMIT = 15;

export const evidenceWorkflow = workflow.define({
  args: {
    windowId: v.id("windows"),
    experimentTag: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    step,
    { windowId, experimentTag, limit },
  ): Promise<{ collected: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentTag,
    });
    const lim = limit ?? DEFAULT_LIMIT;

    if (experiment.taskType === "benchmark") {
      const count = await step.runAction(
        internal.stages["1_evidence"].evidence_steps.loadBenchmarkEvidence,
        { windowId },
      );
      return { collected: count };
    }

    // ECC + Control: reuse evidence for the window; top up if needed
    const window = await step.runQuery(internal.repo.getWindow, { windowId });
    const existingPreview = await step.runQuery(
      internal.repo.listEvidenceByWindowSummary,
      { windowId, limit: lim },
    );
    console.info(
      `[Evidence] Existing evidence count (preview): ${existingPreview.length}/${lim}`,
    );

    if (existingPreview.length >= lim) {
      await step.runMutation(internal.repo.patchExperiment, {
        experimentTag,
        status: "evidence-done",
      });
      console.info(
        `[Evidence] Window already has >= ${lim} items; skipping scrape`,
      );
      return { collected: 0 };
    }

    const existingAll = await step.runQuery(
      internal.repo.listEvidenceByWindowSummary,
      { windowId },
    );
    const existingUrls = new Set(
      existingAll.map((row) => normalizeUrl(row.url)),
    );
    const remaining = Math.max(0, lim - existingAll.length);
    console.info(
      `[Evidence] Existing evidence total: ${existingAll.length}; remaining: ${remaining}`,
    );
    if (remaining === 0) {
      await step.runMutation(internal.repo.patchExperiment, {
        experimentTag,
        status: "evidence-done",
      });
      console.info(`[Evidence] No remaining slots; skipping scrape`);
      return { collected: 0 };
    }

    const results = await step.runAction(
      internal.stages["1_evidence"].evidence_search.searchNews,
      {
        concept: window.concept,
        country: window.country,
        startDate: window.startDate,
        endDate: window.endDate,
        limit: remaining,
      },
    );
    console.info(
      `[Evidence] Search returned ${results.length} articles (requested ${remaining})`,
    );

    const newResults = results.filter((result) => {
      const normalized = normalizeUrl(result.url);
      if (existingUrls.has(normalized)) return false;
      existingUrls.add(normalized);
      return true;
    });
    console.info(`[Evidence] ${newResults.length} articles after URL dedupe`);

    // Insert each result as evidence
    const evidenceIds: Id<"evidence">[] = await Promise.all(
      newResults.map(
        (result: { title: string; url: string; rawContent: string }) =>
          step.runMutation(internal.repo.createEvidence, {
            windowId,
            title: result.title,
            url: result.url,
            rawContent: result.rawContent,
          }),
      ),
    );

    // Neutralize evidence by default. Use experiment config later to choose raw vs neutralized.
    // comment this function out if you don't need to clean the data at all.
    if (evidenceIds.length > 0) {
      await step.runAction(
        internal.stages["1_evidence"].evidence_steps.neutralizeBatch,
        { evidenceIds },
      );
      console.info(
        `[Evidence] Neutralized ${evidenceIds.length} evidence items`,
      );
    } else {
      console.info(`[Evidence] No new evidence to neutralize`);
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentTag,
      status: "evidence-done",
    });

    console.info(
      `[Evidence] Workflow complete — ${evidenceIds.length} articles collected`,
    );

    return { collected: evidenceIds.length };
  },
});

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    const params = parsed.searchParams;
    const dropKeys = [
      "fbclid",
      "gclid",
      "dclid",
      "igshid",
      "mc_cid",
      "mc_eid",
    ];
    for (const key of dropKeys) params.delete(key);
    for (const key of Array.from(params.keys())) {
      if (key.startsWith("utm_")) params.delete(key);
    }
    parsed.search = params.toString() ? `?${params.toString()}` : "";
    const normalized = parsed.toString();
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  } catch {
    return url.trim().toLowerCase();
  }
}
