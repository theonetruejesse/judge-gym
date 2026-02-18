import z from "zod";
import { WindowsTableSchema } from "../../models/window";
import { zInternalAction, zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { buildRandomTag } from "../../utils/tags";
import { zid } from "convex-helpers/server/zod4";
import { internal } from "../../_generated/api";
import { envPreflight } from "../../utils/env_preflight";

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
    handler: async (ctx, args) => {
        return ctx.db.get(args.window_id);
    },
});

export const runWindow = zInternalAction({
    args: z.object({
        window_id: zid("windows"),
    }),
    handler: async (ctx, args) => {
        const window = await ctx.runQuery(internal.domain.window.window_repo.getWindow, { window_id: args.window_id });
        if (!window) throw new Error("Window not found");
    },
});