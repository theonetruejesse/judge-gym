import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";

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
    const lim = limit ?? 15;

    if (experiment.taskType === "benchmark") {
      const count = await step.runAction(
        internal.stages["1_evidence"].evidence_steps.loadBenchmarkEvidence,
        { windowId, concept: experiment.concept },
      );
      return { collected: count };
    }

    // ECC + Control: search news → insert evidence → optionally neutralize
    const window = await step.runQuery(internal.repo.getWindow, { windowId });

    const results = await step.runAction(internal.stages["1_evidence"].evidence_search.searchNews, {
      concept: experiment.concept,
      country: window.country,
      startDate: window.startDate,
      endDate: window.endDate,
      limit: lim,
    });
    console.info(`[Evidence] Found ${results.length} articles`);

    // Insert each result as evidence
    const evidenceIds: Id<"evidence">[] = await Promise.all(
      results.map(
        (result: { title: string; url: string; rawContent: string }) =>
          step.runMutation(internal.repo.createEvidence, {
            windowId,
            title: result.title,
            url: result.url,
            rawContent: result.rawContent,
          }),
      ),
    );

    if (experiment.config.neutralizeEvidence) {
      await step.runAction(
        internal.stages["1_evidence"].evidence_steps.neutralizeBatch,
        { evidenceIds },
      );
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
