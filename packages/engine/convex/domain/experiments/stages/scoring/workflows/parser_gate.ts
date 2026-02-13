import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../../../../platform/utils";
import {
  parseExpertAgreementResponse,
  parseSingleVerdict,
  parseSubsetVerdict,
} from "../parsers/score_parser";

const ParseResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const applyScoreParse = zInternalMutation({
  args: z.object({
    score_id: zid("scores"),
    message_id: zid("llm_messages"),
    raw_output: z.string(),
    label_mapping: z.record(z.string(), z.number()).optional(),
    scoring_method: z.enum(["freeform-suffix-single", "freeform-suffix-subset"]),
  }),
  returns: ParseResultSchema,
  handler: async (
    ctx,
    { score_id, message_id, raw_output, label_mapping, scoring_method },
  ) => {
    const score = await ctx.db.get(score_id);
    const attempt = (score?.attempt_count ?? 0) + 1;
    try {
      const parsed =
        scoring_method === "freeform-suffix-subset"
          ? parseSubsetVerdict(raw_output, label_mapping)
          : parseSingleVerdict(raw_output, label_mapping);
      await ctx.db.patch(score_id, {
        score_message_id: message_id,
        raw_verdict: parsed.rawVerdict,
        decoded_scores: parsed.decodedScores,
        abstained: parsed.abstained,
        parse_status: "parsed",
        parse_error: undefined,
        attempt_count: attempt,
      });
      return { ok: true };
    } catch (err) {
      const error = String(err);
      await ctx.db.patch(score_id, {
        parse_status: "failed",
        parse_error: error,
        attempt_count: attempt,
      });
      return { ok: false, error };
    }
  },
});

export const applyScoreCriticParse = zInternalMutation({
  args: z.object({
    score_id: zid("scores"),
    message_id: zid("llm_messages"),
    raw_output: z.string(),
  }),
  returns: ParseResultSchema,
  handler: async (ctx, { score_id, message_id, raw_output }) => {
    try {
      const parsed = parseExpertAgreementResponse(raw_output);
      await ctx.db.patch(score_id, {
        score_critic_message_id: message_id,
        score_critic_output: raw_output,
        score_critic_reasoning: parsed.reasoning,
        expert_agreement_prob: parsed.expertAgreementProb,
      });
      return { ok: true };
    } catch (err) {
      const error = String(err);
      await ctx.db.patch(score_id, {
        parse_error: error,
      });
      return { ok: false, error };
    }
  },
});
