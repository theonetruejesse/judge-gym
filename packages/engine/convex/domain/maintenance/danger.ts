import z from "zod";
import { zInternalMutation } from "../../utils/custom_fns";
import type { DataModel, Doc } from "../../_generated/dataModel";

const tableNames = [
    "llm_batches",
    "llm_jobs",
    "llm_requests",
    "windows",
    "evidences",
    "experiments",
    "experiment_evidence",
    "runs",
    "samples",
    "rubrics",
    "rubric_critics",
    "scores",
    "score_critics",
    "sample_evidence_scores",
] as const satisfies ReadonlyArray<keyof DataModel>;

type TableName = (typeof tableNames)[number];
const tableNameEnum = z.enum(tableNames);

type TableDeletePlan = {
    name: TableName;
    count: number;
};

export const nukeTables = zInternalMutation({
    args: z.object({
        isDryRun: z.boolean().default(true),
    }),
    returns: z.object({
        isDryRun: z.boolean(),
        tables: z.array(
            z.object({
                name: tableNameEnum,
                count: z.number(),
            }),
        ),
    }),
    handler: async (ctx, args) => {
        const { isDryRun } = args;
        const tables: TableDeletePlan[] = [];

        for (const tableName of tableNames) {
            const docs = await ctx.db.query(tableName).collect();
            tables.push({ name: tableName, count: docs.length });

            if (!isDryRun) {
                for (const doc of docs as Doc<TableName>[]) {
                    await ctx.db.delete(doc._id);
                }
            }
        }

        return { isDryRun, tables };
    },
});
