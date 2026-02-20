import z from "zod";
import { WindowsTableSchema } from "../../models/window";
import { zInternalAction, zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { buildRandomTag } from "../../utils/tags";
import { zid } from "convex-helpers/server/zod4";
import { internal } from "../../_generated/api";
import { Doc } from "../../_generated/dataModel";
import { SearchNewsResults } from "./evidence_search";

const CreateWindowArgsSchema = WindowsTableSchema.pick({
    country: true,
    model: true,
    start_date: true,
    end_date: true,
    query: true,
});

export const createWindow = zInternalMutation({
    args: CreateWindowArgsSchema,
    handler: async (ctx, args) => {
        const window_tag = buildRandomTag();
        return ctx.db.insert("windows", {
            ...args,
            window_tag,
            status: "start",
            current_stage: "l0_raw",
        });
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

export const runWindowSearch = zInternalAction({
    args: z.object({
        window_id: zid("windows"),
        limit: z.number()
    }),
    handler: async (ctx, args) => {
        const window = await ctx.runQuery(internal.domain.window.window_repo.getWindow, { window_id: args.window_id });

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