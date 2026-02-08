import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import { zInternalMutation, zMutation } from "./utils";


// todo, move this to a danger file
/**
 * Dev utilities — use from dashboard or MCP during development.
 */

type DeleteId =
  | Id<"experiments">
  | Id<"scores">
  | Id<"samples">
  | Id<"rubrics">;

export const nukeTables = zInternalMutation({
  args: z.object({
    confirm: z.literal("yes-delete-everything"),
  }),
  handler: async (ctx, { confirm }) => {
    if (confirm !== "yes-delete-everything") return;

    const tables = [
      "experiments",
      "windows",
      "evidences",
      "rubrics",
      "samples",
      "scores",
      "usages",
    ] as const;

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    }
  },
});

export const nukeExperiment = zInternalMutation({
  args: z.object({ experimentTag: z.string() }),
  handler: async (ctx, { experimentTag }) => {
    const experiment = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experimentTag", experimentTag))
      .unique();

    if (!experiment) return { canceled: 0, workflowIds: [] as string[] };

    const workflowResult = await cancelWorkflowsByExperimentTag(
      ctx,
      experiment.experimentTag,
    );

    await deleteExperimentData(ctx, experiment._id);

    return workflowResult;
  },
});

/**
 * Cancel all in-progress workflows whose args reference the given experiment tag and return the cancellation summary.
 *
 * Scans workflows pages for entries with args.experimentTag equal to `experimentTag`, skips entries that already have a `runResult`, cancels the remaining workflows, and returns the count and IDs of canceled workflows.
 *
 * @param experimentTag - The experiment tag to match workflows against
 * @returns An object with `canceled` equal to the number of workflows canceled and `workflowIds` containing the canceled workflow IDs
 */
async function cancelWorkflowsByExperimentTag(
  ctx: {
    runQuery: (...args: any[]) => Promise<any>;
    runMutation: (...args: any[]) => Promise<any>;
  },
  experimentTag: string,
) {
  const workflowIds = new Set<string>();
  let cursor: string | null = null;
  let isDone = false;

  while (!isDone) {
    const pageResult: {
      continueCursor: string;
      isDone: boolean;
      page: Array<{
        args: unknown;
        runResult?: unknown;
        workflowId: string;
      }>;
    } = await ctx.runQuery(components.workflow.workflow.list, {
      order: "desc",
      paginationOpts: { cursor, numItems: 100 },
    });
    for (const row of pageResult.page) {
      const args = row.args as { experimentTag?: string } | undefined;
      if (args?.experimentTag !== experimentTag) continue;
      if (row.runResult) continue;
      workflowIds.add(row.workflowId);
    }
    cursor = pageResult.continueCursor;
    isDone = pageResult.isDone;
  }

  let canceled = 0;
  for (const workflowId of workflowIds) {
    await ctx.runMutation(components.workflow.workflow.cancel, { workflowId });
    canceled += 1;
  }

  return { canceled, workflowIds: Array.from(workflowIds) };
}

/**
 * Remove all database records associated with a specific experiment and then delete the experiment record.
 *
 * Deletes documents from the "scores", "samples", and "rubrics" collections that reference the experiment, then deletes the experiment document itself.
 *
 * @param ctx - Database context exposing `query` and `delete` operations used to locate and remove documents.
 * @param experimentId - The identifier of the experiment whose data should be removed.
 */
async function deleteExperimentData(
  ctx: {
    db: {
      delete: (id: DeleteId) => Promise<void>;
      query: (...args: any[]) => any;
    };
  },
  experimentId: Id<"experiments">,
) {
  // Delete scores
  const scores = await ctx.db
    .query("scores")
    .withIndex("by_experiment", (q: any) => q.eq("experimentId", experimentId))
    .collect();

  for (const score of scores) {
    await ctx.db.delete(score._id);
  }

  // Delete samples
  const samples = await ctx.db
    .query("samples")
    .withIndex("by_experiment", (q: any) => q.eq("experimentId", experimentId))
    .collect();

  for (const sample of samples) {
    await ctx.db.delete(sample._id);
  }

  // Delete rubrics
  const rubrics = await ctx.db
    .query("rubrics")
    .withIndex("by_experiment_model", (q: any) =>
      q.eq("experimentId", experimentId),
    )
    .collect();
  for (const rubric of rubrics) {
    await ctx.db.delete(rubric._id);
  }

  // Delete experiment
  await ctx.db.delete(experimentId);
}
