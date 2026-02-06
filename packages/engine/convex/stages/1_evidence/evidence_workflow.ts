import { v } from "convex/values";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { workflow } from "../../workflow_manager";

export const evidenceWorkflow = workflow.define({
  args: {
    windowId: v.id("windows"),
    experimentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (
    step,
    { windowId, experimentId, limit },
  ): Promise<{ collected: number }> => {
    const experiment = await step.runQuery(internal.repo.getExperiment, {
      experimentId,
    });
    const lim = limit ?? 15;

    if (experiment.taskType === "benchmark") {
      const count = await step.runAction(
        internal.stages["1_evidence"].evidence_steps.loadBenchmarkEvidence,
        { windowId, concept: experiment.concept },
      );
      return { collected: count };
    }

    // ECC + Control: scrape → optionally neutralize
    const window = await step.runQuery(internal.repo.getWindow, { windowId });
    const evidenceIds: Id<"evidence">[] = await step.runAction(
      internal.stages["1_evidence"].evidence_steps.scrapeNews,
      {
        windowId,
        concept: experiment.concept,
        country: window.country,
        limit: lim,
      },
    );

    if (experiment.config.neutralizeEvidence) {
      await step.runAction(
        internal.stages["1_evidence"].evidence_steps.neutralizeBatch,
        { evidenceIds },
      );
    }

    await step.runMutation(internal.repo.patchExperiment, {
      experimentId,
      status: "evidence-done",
    });

    return { collected: evidenceIds.length };
  },
});
