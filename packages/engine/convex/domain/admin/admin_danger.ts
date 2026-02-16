import z from "zod";
import { zInternalAction, zInternalMutation } from "../../platform/utils";
import { internal } from "../../_generated/api";

const TABLES = [
  "experiments",
  "windows",
  "evidences",
  "experiment_evidence",
  "rubrics",
  "samples",
  "scores",
  "config_templates",
  "run_configs",
  "scheduler_state",
  "runs",
  "run_stages",
  "llm_requests",
  "llm_messages",
  "llm_batches",
  "llm_batch_items",
] as const;

const TableNameSchema = z.enum(TABLES);
type TableName = z.infer<typeof TableNameSchema>;

export const deletePage: ReturnType<typeof zInternalMutation> =
  zInternalMutation({
    args: z.object({
      table: TableNameSchema,
      cursor: z.string().optional(),
    }),
    returns: z.object({
      deleted: z.number(),
      done: z.boolean(),
      nextCursor: z.string().optional(),
    }),
    handler: async (ctx, { table, cursor }) => {
      const result: any = await ctx.db
        .query(table)
        .paginate({ cursor: cursor ?? null, numItems: 1000 });
      for (const doc of result.page) {
        await ctx.db.delete(doc._id);
      }
      return {
        deleted: result.page.length,
        done: result.isDone,
        nextCursor: result.continueCursor ?? undefined,
      };
    },
  });

export const nukeTables: ReturnType<typeof zInternalAction> = zInternalAction({
  args: z.object({}),
  returns: z.object({ deleted: z.record(z.string(), z.number()) }),
  handler: async (ctx) => {
    const deleted: Record<string, number> = {};
    for (const table of TABLES) {
      let cursor: string | undefined = undefined;
      let total = 0;
      while (true) {
        const page: any = await ctx.runMutation(
          internal.domain.admin.admin_danger.deletePage,
          { table, cursor },
        );
        total += page.deleted;
        if (page.done) break;
        cursor = page.nextCursor;
      }
      deleted[table] = total;
    }
    return { deleted };
  },
});
