import z from "zod";
import { WindowRunsTableSchema, WindowsTableSchema } from "../../models/window";
import { zInternalAction, zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import { internal } from "../../_generated/api";
import { Doc, Id } from "../../_generated/dataModel";
import { SearchNewsResults } from "./evidence_search";

const CreateWindowArgsSchema = z.object({
    country: WindowsTableSchema.shape.country,
    start_date: WindowsTableSchema.shape.start_date,
    end_date: WindowsTableSchema.shape.end_date,
    query: WindowsTableSchema.shape.query,
    default_target_count: WindowsTableSchema.shape.default_target_count.optional(),
});

const CreateWindowRunArgsSchema = z.object({
    window_id: zid("windows"),
    model: WindowRunsTableSchema.shape.model,
    target_count: WindowRunsTableSchema.shape.target_count.optional(),
    target_stage: WindowRunsTableSchema.shape.target_stage.default("l3_abstracted"),
    pause_after: WindowRunsTableSchema.shape.pause_after.optional(),
});

export type CreateWindowResult = {
    window_id: Id<"windows">,
};
export const createWindow = zInternalMutation({
    args: CreateWindowArgsSchema,
    returns: z.object({
        window_id: zid("windows"),
    }),
    handler: async (ctx, args): Promise<CreateWindowResult> => {
        const window_id = await ctx.db.insert("windows", {
            ...args,
            default_target_count: args.default_target_count ?? 0,
        });
        return { window_id };
    },
});

export const createWindowRun = zInternalMutation({
    args: CreateWindowRunArgsSchema,
    returns: z.object({
        window_run_id: zid("window_runs"),
    }),
    handler: async (ctx, args) => {
        const window = await ctx.db.get(args.window_id);
        if (!window) throw new Error("Window not found");

        const window_run_id = await ctx.db.insert("window_runs", {
            window_id: args.window_id,
            model: args.model,
            target_count: args.target_count ?? window.default_target_count ?? 0,
            target_stage: args.target_stage,
            pause_after: args.pause_after ?? null,
            status: "start",
            current_stage: "l0_raw",
            completed_count: 0,
            workflow_id: null,
            workflow_run_id: null,
            last_error_message: null,
        });
        return { window_run_id };
    },
});

export const getWindow = zInternalQuery({
    args: z.object({
        window_id: zid("windows"),
    }),
    handler: async (ctx, args): Promise<Doc<"windows">> => {
        const window = await ctx.db.get(args.window_id);
        if (!window) throw new Error("Window not found");
        return window;
    },
});

export const getWindowRun = zInternalQuery({
    args: z.object({
        window_run_id: zid("window_runs"),
    }),
    handler: async (ctx, args): Promise<Doc<"window_runs">> => {
        const windowRun = await ctx.db.get(args.window_run_id);
        if (!windowRun) throw new Error("Window run not found");
        return windowRun;
    },
});

export const listWindows = zInternalQuery({
    args: z.object({}),
    handler: async (ctx) => {
        return ctx.db.query("windows").collect();
    },
});

export const listWindowRuns = zInternalQuery({
    args: z.object({
        window_id: zid("windows").optional(),
    }),
    handler: async (ctx, args) => {
        if (args.window_id) {
            return ctx.db
                .query("window_runs")
                .withIndex("by_window", (q) => q.eq("window_id", args.window_id!))
                .collect();
        }
        return ctx.db.query("window_runs").collect();
    },
});

export const getEvidence = zInternalQuery({
    args: z.object({
        evidence_id: zid("evidences"),
    }),
    handler: async (ctx, args) => {
        return ctx.db.get(args.evidence_id);
    },
});

export const runWindowSearch = zInternalAction({
    args: z.object({
        window_run_id: zid("window_runs"),
        limit: z.number()
    }),
    handler: async (ctx, args) => {
        const windowRun = await ctx.runQuery(
            internal.domain.window.window_repo.getWindowRun,
            { window_run_id: args.window_run_id },
        );
        const window = await ctx.runQuery(
            internal.domain.window.window_repo.getWindow,
            { window_id: windowRun.window_id },
        );

        const news: SearchNewsResults = await ctx.runAction(internal.domain.window.evidence_search.searchNews, {
            query: window.query,
            country: window.country,
            start_date: window.start_date,
            end_date: window.end_date,
            limit: args.limit
        });

        return news;
    },
});

const EvidenceInsertSchema = z.object({
    title: z.string(),
    url: z.string(),
    raw_content: z.string(),
});

export const insertEvidenceBatch = zInternalMutation({
    args: z.object({
        window_run_id: zid("window_runs"),
        evidences: z.array(EvidenceInsertSchema),
    }),
    returns: z.object({
        inserted: z.number(),
        total: z.number(),
    }),
    handler: async (ctx, args) => {
        const windowRun = await ctx.db.get(args.window_run_id);
        if (!windowRun) throw new Error("Window run not found");
        for (const evidence of args.evidences) {
            await ctx.db.insert("evidences", {
                window_id: windowRun.window_id,
                window_run_id: args.window_run_id,
                title: evidence.title,
                url: evidence.url,
                l0_raw_content: evidence.raw_content,
                l1_cleaned_content: null,
                l2_neutralized_content: null,
                l3_abstracted_content: null,
            });
        }

        const total = await ctx.db
            .query("evidences")
            .withIndex("by_window_run_id", (q) => q.eq("window_run_id", args.window_run_id))
            .collect();
        return { inserted: args.evidences.length, total: total.length };
    },
});

export const listEvidenceByWindow = zInternalQuery({
    args: z.object({
        window_id: zid("windows"),
    }),
    handler: async (ctx, args) => {
        return ctx.db
            .query("evidences")
            .withIndex("by_window_id", (q) => q.eq("window_id", args.window_id))
            .collect();
    },
});

export const listEvidenceByWindowRun = zInternalQuery({
    args: z.object({
        window_run_id: zid("window_runs"),
    }),
    handler: async (ctx, args) => {
        return ctx.db
            .query("evidences")
            .withIndex("by_window_run_id", (q) => q.eq("window_run_id", args.window_run_id))
            .collect();
    },
});

const BackfillLegacyWindowRunsResultSchema = z.object({
    windows_patched: z.number(),
    runs_created: z.number(),
    evidences_patched: z.number(),
    skipped_windows: z.number(),
    active_windows_restarted_as_error: z.number(),
});

function normalizeLegacyWindowStage(
    stage: string | null | undefined,
): z.infer<typeof WindowRunsTableSchema.shape.current_stage> {
    switch (stage) {
        case "l0_raw":
        case "l1_cleaned":
        case "l2_neutralized":
        case "l3_abstracted":
            return stage;
        default:
            return "l0_raw";
    }
}

function normalizeLegacyWindowStatus(
    status: string | null | undefined,
): z.infer<typeof WindowRunsTableSchema.shape.status> {
    switch (status) {
        case "start":
        case "queued":
        case "running":
        case "paused":
        case "completed":
        case "error":
        case "canceled":
            return status;
        default:
            return "start";
    }
}

export const backfillLegacyWindowRuns = zInternalMutation({
    args: z.object({}),
    returns: BackfillLegacyWindowRunsResultSchema,
    handler: async (ctx) => {
        const windows = await ctx.db.query("windows").collect();
        let windows_patched = 0;
        let runs_created = 0;
        let evidences_patched = 0;
        let skipped_windows = 0;
        let active_windows_restarted_as_error = 0;

        for (const window of windows) {
            const legacyWindow = window as Doc<"windows"> & {
                target_count?: number;
                completed_count?: number;
                current_stage?: string | null;
                status?: string | null;
                model?: Doc<"window_runs">["model"];
                workflow_id?: string | null;
                workflow_run_id?: string | null;
                last_error_message?: string | null;
            };

            const defaultTargetCount = legacyWindow.default_target_count
                ?? legacyWindow.target_count
                ?? 0;
            if (legacyWindow.default_target_count == null) {
                await ctx.db.patch(window._id, {
                    default_target_count: defaultTargetCount,
                });
                windows_patched += 1;
            }

            const existingRuns = await ctx.db
                .query("window_runs")
                .withIndex("by_window", (q) => q.eq("window_id", window._id))
                .collect();

            const evidences = await ctx.db
                .query("evidences")
                .withIndex("by_window_id", (q) => q.eq("window_id", window._id))
                .collect();

            let windowRunId = existingRuns[0]?._id ?? null;

            if (!windowRunId) {
                const rawStatus = normalizeLegacyWindowStatus(legacyWindow.status);
                const current_stage = normalizeLegacyWindowStage(legacyWindow.current_stage);
                const wasActive = rawStatus === "start" || rawStatus === "queued" || rawStatus === "running" || rawStatus === "paused";
                if (wasActive) {
                    active_windows_restarted_as_error += 1;
                }

                const status: Doc<"window_runs">["status"] = wasActive ? "error" : rawStatus;
                const last_error_message = wasActive
                    ? legacyWindow.last_error_message
                        ?? "Legacy window execution was invalidated during window run migration. Start a fresh window run from the definition."
                    : legacyWindow.last_error_message ?? null;

                const needsSyntheticRun = evidences.length > 0
                    || legacyWindow.model != null
                    || legacyWindow.status != null
                    || legacyWindow.target_count != null
                    || legacyWindow.workflow_id != null
                    || legacyWindow.workflow_run_id != null;

                if (!needsSyntheticRun) {
                    skipped_windows += 1;
                    continue;
                }

                windowRunId = await ctx.db.insert("window_runs", {
                    window_id: window._id,
                    model: legacyWindow.model ?? "gpt-4.1-mini",
                    status,
                    current_stage,
                    pause_after: null,
                    target_stage: "l3_abstracted",
                    target_count: legacyWindow.target_count ?? defaultTargetCount,
                    completed_count: legacyWindow.completed_count ?? evidences.length,
                    workflow_id: null,
                    workflow_run_id: null,
                    last_error_message,
                });
                runs_created += 1;
            }

            for (const evidence of evidences) {
                if (evidence.window_run_id == null) {
                    await ctx.db.patch(evidence._id, {
                        window_run_id: windowRunId,
                    });
                    evidences_patched += 1;
                }
            }
        }

        return {
            windows_patched,
            runs_created,
            evidences_patched,
            skipped_windows,
            active_windows_restarted_as_error,
        };
    },
});
