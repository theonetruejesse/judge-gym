import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { buildRandomTag } from "../../utils/tags";
import type { Id } from "../../_generated/dataModel";

export const CreateExperimentArgsSchema = ExperimentsTableSchema.pick({
  rubric_config: true,
  scoring_config: true,
});

export const createExperiment = zInternalMutation({
  args: CreateExperimentArgsSchema,
  returns: zid("experiments"),
  handler: async (ctx, args) => {
    return ctx.db.insert("experiments", {
      experiment_tag: buildRandomTag(),
      rubric_config: args.rubric_config,
      scoring_config: args.scoring_config,
    });
  },
});

export const insertExperimentEvidences = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    evidence_ids: z.array(zid("evidences")).min(1),
  }),
  handler: async (ctx, args) => {
    const experiment = await ctx.db.get(args.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const insertIds = new Set<Id<"evidences">>(args.evidence_ids);

    for (const evidence_id of insertIds) {
      await ctx.db.insert("experiment_evidence", {
        experiment_id: experiment._id,
        evidence_id,
      });
    }
  },
});
