import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../utils/custom_fns";
import { SemanticLevelSchema } from "../../models/_shared";
import { getStageConfig, WindowOrchestrator } from "./window_orchestrator";
import { Doc } from "../../_generated/dataModel";
import { internal } from "../../_generated/api";


// todo, fix later
export const startWindowOrchestration = zInternalMutation({
    args: z.object({
        window_id: zid("windows"),
    }),
    handler: async (ctx, args) => {
        const window = await ctx.db.get(args.window_id);
        if (!window) throw new Error("Window not found");

        if (window.status === "completed" || window.status === "canceled") {
            return;
        }

        await ctx.db.patch(args.window_id, {
            status: "running",
            current_stage: "l1_cleaned",
        });

        const orchestrator = new WindowOrchestrator(ctx);
        await orchestrator.enqueueStage(args.window_id, "l1_cleaned");
    },
});

export const enqueueWindowStage = zInternalMutation({
    args: z.object({
        window_id: zid("windows"),
        stage: SemanticLevelSchema,
    }),
    handler: async (ctx, args) => {
        const orchestrator = new WindowOrchestrator(ctx);
        await orchestrator.enqueueStage(args.window_id, args.stage);
    },
});

export const applyRequestResult = zInternalMutation({
    args: z.object({
        request_id: zid("llm_requests"),
        custom_key: z.string(),
        output: z.string(),
        input_tokens: z.number().optional(),
        output_tokens: z.number().optional(),
    }),
    handler: async (ctx, args) => {
        const orchestrator = new WindowOrchestrator(ctx);
        const { targetId, stage } = orchestrator.parseRequestKey(args.custom_key);
        const config = getStageConfig(stage);
        await ctx.db.patch(targetId, {
            [config.outputField]: args.output,
            [config.requestIdField]: args.request_id,
        } as Partial<Doc<"evidences">>);
        await ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.patchRequest,
            {
                request_id: args.request_id,
                patch: {
                    status: "success",
                    assistant_output: args.output,
                    input_tokens: args.input_tokens,
                    output_tokens: args.output_tokens,
                },
            },
        );
    },
});
