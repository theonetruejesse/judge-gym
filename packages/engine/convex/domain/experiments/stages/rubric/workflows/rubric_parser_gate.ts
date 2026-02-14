import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import {
  parseRubricResponse,
  parseQualityResponse,
} from "../rubric_parser";

const ParseResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const applyRubricParse = zInternalMutation({
  args: z.object({
    rubric_id: zid("rubrics"),
    message_id: zid("llm_messages"),
    raw_output: z.string(),
    scale_size: z.number(),
  }),
  returns: ParseResultSchema,
  handler: async (ctx, { rubric_id, message_id, raw_output, scale_size }) => {
    const rubric = await ctx.db.get(rubric_id);
    const attempt = (rubric?.attempt_count ?? 0) + 1;
    try {
      const parsed = parseRubricResponse(raw_output, scale_size);
      await ctx.db.patch(rubric_id, {
        stages: parsed.stages,
        rubricer_message_id: message_id,
        rubricer_output: raw_output,
        parse_status: "parsed",
        parse_error: undefined,
        attempt_count: attempt,
      });
      return { ok: true };
    } catch (err) {
      const error = String(err);
      await ctx.db.patch(rubric_id, {
        parse_status: "failed",
        parse_error: error,
        attempt_count: attempt,
      });
      return { ok: false, error };
    }
  },
});

export const applyRubricCriticParse = zInternalMutation({
  args: z.object({
    rubric_id: zid("rubrics"),
    message_id: zid("llm_messages"),
    raw_output: z.string(),
  }),
  returns: ParseResultSchema,
  handler: async (ctx, { rubric_id, message_id, raw_output }) => {
    try {
      const quality = parseQualityResponse(raw_output);
      await ctx.db.patch(rubric_id, {
        rubric_critic_message_id: message_id,
        rubric_critic_output: raw_output,
        rubric_critic_reasoning: quality.reasoning,
        quality_stats: {
          observability_score: quality.observabilityScore,
          discriminability_score: quality.discriminabilityScore,
        },
      });
      return { ok: true };
    } catch (err) {
      const error = String(err);
      await ctx.db.patch(rubric_id, {
        parse_error: error,
      });
      return { ok: false, error };
    }
  },
});
