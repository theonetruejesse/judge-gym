
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { type SemanticLevel } from "../../models/_shared";
import { type ModelType } from "../../platform/providers/provider_types";
import { BaseOrchestrator } from "../orchestrator/base";
import { internal } from "../../_generated/api";
import {
    CLEANING_INSTRUCTIONS,
    NEUTRALIZE_INSTRUCTIONS,
    STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
    abstractPrompt,
    cleanPrompt,
    neutralizePrompt,
} from "./evidence_prompts";

type Evidence = Doc<"evidences">;

type StageConfig = {
    inputField: "l0_raw_content" | "l1_cleaned_content" | "l2_neutralized_content";
    outputField: "l1_cleaned_content" | "l2_neutralized_content" | "l3_abstracted_content";
    requestIdField: "l1_request_id" | "l2_request_id" | "l3_request_id";
    pendingIndex: "by_window_l1_pending" | "by_window_l2_pending" | "by_window_l3_pending";
    systemPrompt: string;
    buildPrompt: (input: string) => string;
};

type StageConfigRecordType = Record<Exclude<SemanticLevel, "l0_raw">, StageConfig>;
const STAGE_CONFIGS: StageConfigRecordType = {
    l1_cleaned: {
        inputField: "l0_raw_content",
        outputField: "l1_cleaned_content",
        requestIdField: "l1_request_id",
        pendingIndex: "by_window_l1_pending",
        systemPrompt: CLEANING_INSTRUCTIONS,
        buildPrompt: cleanPrompt,
    },
    l2_neutralized: {
        inputField: "l1_cleaned_content",
        outputField: "l2_neutralized_content",
        requestIdField: "l2_request_id",
        pendingIndex: "by_window_l2_pending",
        systemPrompt: NEUTRALIZE_INSTRUCTIONS,
        buildPrompt: neutralizePrompt,
    },
    l3_abstracted: {
        inputField: "l2_neutralized_content",
        outputField: "l3_abstracted_content",
        requestIdField: "l3_request_id",
        pendingIndex: "by_window_l3_pending",
        systemPrompt: STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
        buildPrompt: abstractPrompt,
    },
};

export class WindowOrchestrator extends BaseOrchestrator<Id<"windows">, SemanticLevel> {
    private readonly stageConfigs: StageConfigRecordType = STAGE_CONFIGS;

    constructor(ctx: MutationCtx) {
        super(ctx);
    }

    public getStageConfig(stage: SemanticLevel): StageConfig {
        if (stage === "l0_raw") throw new Error("l0_raw is not a processing stage");
        return this.stageConfigs[stage];
    }

    protected async listPendingTargets(
        windowId: Id<"windows">,
        stage: SemanticLevel,
    ) {
        const config = this.getStageConfig(stage);
        const evidences = await this.ctx.db
            .query("evidences")
            .withIndex(config.pendingIndex, (q) =>
                q.eq("window_id", windowId)
                    .eq(config.outputField, null)
                    .eq(config.requestIdField, null),
            )
            .collect();

        const pending: Array<{ targetId: Id<"evidences">; input: string }> = [];
        for (const evidence of evidences) {
            const input = evidence[config.inputField];
            if (input === null) continue;

            const custom_key = this.makeRequestKey(evidence._id, stage);
            const pendingRequests = await this.ctx.db
                .query("llm_requests")
                .withIndex("by_custom_key_status", (q) =>
                    q.eq("custom_key", custom_key).eq("status", "pending"),
                )
                .collect();
            if (pendingRequests.length > 0) continue;

            const requests = await this.ctx.db
                .query("llm_requests")
                .withIndex("by_custom_key", (q) => q.eq("custom_key", custom_key))
                .collect();
            const maxAttempts = requests.reduce(
                (max, req) => Math.max(max, req.attempts ?? 0),
                0,
            );
            if (maxAttempts >= this.policy.max_request_attempts) continue;

            pending.push({ targetId: evidence._id, input });
        }

        return pending;
    }

    protected async getModelForStage(
        windowId: Id<"windows">,
        _stage: SemanticLevel,
    ): Promise<ModelType> {
        const window = await this.ctx.db.get(windowId);
        if (!window) throw new Error("Window not found");
        return window.model;
    }

    protected buildPrompts(stage: SemanticLevel, input: string) {
        const config = this.getStageConfig(stage);
        return {
            system: config.systemPrompt,
            user: config.buildPrompt(input),
        };
    }

    protected async onRequestCreated(): Promise<void> {
        return;
    }

    public makeRequestKey(targetId: string, stage: SemanticLevel): string {
        return `evidence:${targetId}:${stage}`;
    }
    public parseRequestKey(key: string): { targetId: Id<"evidences">; stage: SemanticLevel } {
        const [targetType, targetId, stage] = key.split(":");
        if (targetType !== "evidence") throw new Error(`Unexpected target type in key: ${key}`);
        return { targetId: targetId as Id<"evidences">, stage: stage as SemanticLevel };
    }

    public makeProcessKey(processId: Id<"windows">, stage: SemanticLevel): string {
        return `window:${processId}:${stage}`;
    }
    public parseProcessKey(key: string): { processId: Id<"windows">; stage: SemanticLevel } {
        const [processType, processId, stage] = key.split(":");
        if (processType !== "window") throw new Error(`Unexpected process type in key: ${key}`);
        return { processId: processId as Id<"windows">, stage: stage as SemanticLevel };
    }

    async recordSuccess(customKey: string, requestId: Id<"llm_requests">, output: string) {
        const { targetId, stage } = this.parseRequestKey(customKey);
        const config = this.getStageConfig(stage);
        await this.ctx.db.patch(targetId, {
            [config.outputField]: output,
            [config.requestIdField]: requestId,
        } as Partial<Evidence>);
        await this.ctx.runMutation(
            internal.domain.llm_calls.llm_request_repo.patchRequest,
            {
                request_id: requestId,
                patch: {
                    status: "success",
                    assistant_output: output,
                },
            },
        );
    }
}
