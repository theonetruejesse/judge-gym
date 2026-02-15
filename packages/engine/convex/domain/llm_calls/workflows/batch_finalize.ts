import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../platform/utils";
import { internal } from "../../../_generated/api";
import type { Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import { providerSchema } from "../../../models/core";
import { getRateLimitKeysForModel, rateLimiter } from "../../../platform/rate_limiter";
import { ENGINE_SETTINGS } from "../../../settings";

async function getPolicyForBatch(
  ctx: MutationCtx,
  batch_id: Id<"llm_batches">,
) {
  const batch = await ctx.db.get(batch_id);
  if (!batch) throw new Error("Batch not found");
  if (!batch.run_id) return ENGINE_SETTINGS.run_policy;
  const run = await ctx.runQuery(internal.domain.runs.repo.getRun, {
    run_id: batch.run_id,
  });
  return run?.policy_snapshot ?? ENGINE_SETTINGS.run_policy;
}

export const finalizeBatch = zInternalMutation({
  args: z.object({
    batch_id: zid("llm_batches"),
    provider: providerSchema,
    results: z.array(
      z.object({
        custom_id: z.string(),
        status: z.enum(["completed", "error"]),
        output: z
          .object({
            assistant_output: z.string().optional(),
            assistant_reasoning: z.string().optional(),
            input_tokens: z.number().optional(),
            output_tokens: z.number().optional(),
            total_tokens: z.number().optional(),
            cached_input_tokens: z.number().optional(),
            reasoning_tokens: z.number().optional(),
          })
          .optional(),
        error: z.string().optional(),
      }),
    ),
  }),
  returns: z.object({ processed: z.number() }),
  handler: async (ctx, { batch_id, provider, results }) => {
    const now = Date.now();
    const policy = await getPolicyForBatch(ctx, batch_id);
    const items = await ctx.db
      .query("llm_batch_items")
      .withIndex("by_batch", (q) => q.eq("batch_id", batch_id))
      .collect();

    const itemByCustomId = new Map(items.map((i) => [i.custom_id, i]));
    const rubricCriticExperiments = new Set<Id<"experiments">>();
    const scoreCriticExperiments = new Set<Id<"experiments">>();
    const stageRefresh: Record<
      "rubric_gen" | "rubric_critic" | "score_gen" | "score_critic",
      Set<Id<"experiments">>
    > = {
      rubric_gen: new Set<Id<"experiments">>(),
      rubric_critic: new Set<Id<"experiments">>(),
      score_gen: new Set<Id<"experiments">>(),
      score_critic: new Set<Id<"experiments">>(),
    };
    const usageByModel = new Map<string, { input: number; output: number }>();

    for (const result of results) {
      const item = itemByCustomId.get(result.custom_id);
      if (!item) continue;

      const request = await ctx.db.get(item.request_id);
      if (!request) continue;

      if (result.status === "error") {
        const nextAttempt = (request.attempt ?? 0) + 1;
        const shouldRetry = nextAttempt < policy.max_request_attempts;
        const next_retry_at = shouldRetry
          ? now + policy.retry_backoff_ms
          : undefined;
        await ctx.db.patch(item._id, {
          status: "error",
          last_error: result.error ?? "provider_error",
        });
        await ctx.db.patch(request._id, {
          status: shouldRetry ? "queued" : "error",
          attempt: nextAttempt,
          last_error: result.error ?? "provider_error",
          next_retry_at,
        });
        if (request.experiment_id) {
          const refreshSet =
            stageRefresh[request.stage as keyof typeof stageRefresh];
          refreshSet?.add(request.experiment_id);
        }
        continue;
      }

      const assistantOutput = result.output?.assistant_output ?? "";
      const messageId = await ctx.runMutation(
        internal.domain.llm_calls.llm_messages.createLlmMessage,
        {
          system_prompt: request.system_prompt ?? undefined,
          user_prompt: request.user_prompt ?? "",
          assistant_output: assistantOutput,
          assistant_reasoning: result.output?.assistant_reasoning,
          input_tokens: result.output?.input_tokens,
          output_tokens: result.output?.output_tokens,
          total_tokens: result.output?.total_tokens,
          cached_input_tokens: result.output?.cached_input_tokens,
          reasoning_tokens: result.output?.reasoning_tokens,
          provider: provider as never,
          model: request.model,
          temperature: request.temperature ?? undefined,
          top_p: request.top_p ?? undefined,
          seed: request.seed ?? undefined,
          max_tokens: request.max_tokens ?? undefined,
          stop: request.stop ?? undefined,
        },
      );

      await ctx.db.patch(item._id, { status: "completed" });
      await ctx.db.patch(request._id, {
        status: "completed",
        result_message_id: messageId,
        parse_error: undefined,
      });

      const inputTokens = result.output?.input_tokens ?? 0;
      const outputTokens = result.output?.output_tokens ?? 0;
      if (inputTokens > 0 || outputTokens > 0) {
        const entry = usageByModel.get(request.model) ?? { input: 0, output: 0 };
        entry.input += inputTokens;
        entry.output += outputTokens;
        usageByModel.set(request.model, entry);
      }

      // Parse + apply to domain tables
      switch (request.stage) {
        case "evidence_clean": {
          if (!request.evidence_id) break;
          await ctx.runMutation(internal.domain.experiments.repo.patchEvidence, {
            evidence_id: request.evidence_id,
            cleaned_content: assistantOutput,
          });
          break;
        }
        case "evidence_neutralize": {
          if (!request.evidence_id) break;
          await ctx.runMutation(internal.domain.experiments.repo.patchEvidence, {
            evidence_id: request.evidence_id,
            neutralized_content: assistantOutput,
          });
          break;
        }
        case "evidence_abstract": {
          if (!request.evidence_id) break;
          await ctx.runMutation(internal.domain.experiments.repo.patchEvidence, {
            evidence_id: request.evidence_id,
            abstracted_content: assistantOutput,
          });
          break;
        }
        case "rubric_gen": {
          if (!request.rubric_id) break;
          const rubric = await ctx.db.get(request.rubric_id);
          if (!rubric) break;
          const parseResult = await ctx.runMutation(
            internal.domain.experiments.stages.rubric.workflows.rubric_parser_gate
              .applyRubricParse,
            {
              rubric_id: rubric._id,
              message_id: messageId,
              raw_output: assistantOutput,
              scale_size: rubric.scale_size,
            },
          );
          if (!parseResult.ok) {
            const nextAttempt = (request.attempt ?? 0) + 1;
            const shouldRetry = nextAttempt < policy.max_request_attempts;
            const next_retry_at = shouldRetry
              ? now + policy.retry_backoff_ms
              : undefined;
            await ctx.db.patch(request._id, {
              status: shouldRetry ? "queued" : "error",
              attempt: nextAttempt,
              parse_error: parseResult.error ?? "parse_error",
              next_retry_at,
            });
          }
          if (parseResult.ok && request.experiment_id) {
            rubricCriticExperiments.add(request.experiment_id);
          }
          break;
        }
        case "rubric_critic": {
          if (!request.rubric_id) break;
          const parseResult = await ctx.runMutation(
            internal.domain.experiments.stages.rubric.workflows.rubric_parser_gate
              .applyRubricCriticParse,
            {
              rubric_id: request.rubric_id,
              message_id: messageId,
              raw_output: assistantOutput,
            },
          );
          if (!parseResult.ok) {
            const nextAttempt = (request.attempt ?? 0) + 1;
            const shouldRetry = nextAttempt < policy.max_request_attempts;
            const next_retry_at = shouldRetry
              ? now + policy.retry_backoff_ms
              : undefined;
            await ctx.db.patch(request._id, {
              status: shouldRetry ? "queued" : "error",
              attempt: nextAttempt,
              parse_error: parseResult.error ?? "parse_error",
              next_retry_at,
            });
          }
          break;
        }
        case "score_gen": {
          const sampleId = request.sample_id;
          const evidenceId = request.evidence_id;
          if (!sampleId || !evidenceId) break;
          const sample = await ctx.db.get(sampleId);
          if (!sample) break;
          const score = await ctx.db
            .query("scores")
            .withIndex("by_sample", (q) => q.eq("sample_id", sample._id))
            .filter((q) => q.eq(q.field("evidence_id"), evidenceId))
            .first();
          if (!score) break;
          const experiment = request.experiment_id
            ? await ctx.db.get(request.experiment_id)
            : null;
          if (!experiment) break;
          const parseResult = await ctx.runMutation(
            internal.domain.experiments.stages.scoring.workflows.scoring_parser_gate
              .applyScoreParse,
            {
              score_id: score._id,
              message_id: messageId,
              raw_output: assistantOutput,
              label_mapping: sample.label_mapping ?? undefined,
              scoring_method: experiment.config.scoring_stage.method,
              abstain_enabled: experiment.config.scoring_stage.abstain_enabled,
            },
          );
          if (!parseResult.ok) {
            const nextAttempt = (request.attempt ?? 0) + 1;
            const shouldRetry = nextAttempt < policy.max_request_attempts;
            const next_retry_at = shouldRetry
              ? now + policy.retry_backoff_ms
              : undefined;
            await ctx.db.patch(request._id, {
              status: shouldRetry ? "queued" : "error",
              attempt: nextAttempt,
              parse_error: parseResult.error ?? "parse_error",
              next_retry_at,
            });
          }
          if (parseResult.ok && request.experiment_id) {
            scoreCriticExperiments.add(request.experiment_id);
          }
          break;
        }
        case "score_critic": {
          const sampleId = request.sample_id;
          const evidenceId = request.evidence_id;
          if (!sampleId || !evidenceId) break;
          const score = await ctx.db
            .query("scores")
            .withIndex("by_sample", (q) => q.eq("sample_id", sampleId))
            .filter((q) => q.eq(q.field("evidence_id"), evidenceId))
            .first();
          if (!score) break;
          const parseResult = await ctx.runMutation(
            internal.domain.experiments.stages.scoring.workflows.scoring_parser_gate
              .applyScoreCriticParse,
            {
              score_id: score._id,
              message_id: messageId,
              raw_output: assistantOutput,
            },
          );
          if (!parseResult.ok) {
            const nextAttempt = (request.attempt ?? 0) + 1;
            const shouldRetry = nextAttempt < policy.max_request_attempts;
            const next_retry_at = shouldRetry
              ? now + policy.retry_backoff_ms
              : undefined;
            await ctx.db.patch(request._id, {
              status: shouldRetry ? "queued" : "error",
              attempt: nextAttempt,
              parse_error: parseResult.error ?? "parse_error",
              next_retry_at,
            });
          }
          break;
        }
        default:
          break;
      }

      if (request.experiment_id) {
        const refreshSet =
          stageRefresh[request.stage as keyof typeof stageRefresh];
        refreshSet?.add(request.experiment_id);
      }
    }

    for (const [model, usage] of usageByModel.entries()) {
      const keys = getRateLimitKeysForModel(model);
      if (!keys) continue;
      if (usage.input > 0) {
        await rateLimiter.limit(ctx, keys.inputKey, {
          count: usage.input,
          throws: false,
        });
      }
      if (usage.output > 0) {
        await rateLimiter.limit(ctx, keys.outputKey, {
          count: usage.output,
          throws: false,
        });
      }
    }

    for (const experiment_id of rubricCriticExperiments) {
      await ctx.runMutation(
        internal.domain.experiments.stages.rubric.workflows.rubric_enqueue_critics
          .enqueueRubricCritics,
        { experiment_id },
      );
      await ctx.runMutation(
        internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
        { experiment_id, stage: "rubric_gen" },
      );
      await ctx.runMutation(
        internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
        { experiment_id, stage: "rubric_critic" },
      );
    }

    for (const experiment_id of scoreCriticExperiments) {
      await ctx.runMutation(
        internal.domain.experiments.stages.scoring.workflows.scoring_enqueue_critics
          .enqueueScoreCritics,
        { experiment_id },
      );
      await ctx.runMutation(
        internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
        { experiment_id, stage: "score_gen" },
      );
      await ctx.runMutation(
        internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
        { experiment_id, stage: "score_critic" },
      );
    }

    for (const [stage, experiments] of Object.entries(stageRefresh)) {
      for (const experiment_id of experiments) {
        await ctx.runMutation(
          internal.domain.runs.workflows.run_state.refreshRunStageCountsForExperiment,
          { experiment_id, stage: stage as never },
        );
      }
    }

    return { processed: results.length };
  },
});
