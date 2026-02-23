import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation } from "../../utils/custom_fns";
import type { Id } from "../../_generated/dataModel";
import { CreateExperimentArgsSchema } from "./experiments_repo";
import { internal } from "../../_generated/api";

export const initExperiment = zInternalMutation({
  args: z.object({
    experiment_config: CreateExperimentArgsSchema,
    evidence_ids: z.array(zid("evidences")).min(1),
  }),
  handler: async (ctx, args) => {
    const experiment_id: Id<"experiments"> = await ctx.runMutation(internal.domain.runs.experiments_repo.createExperiment,
      args.experiment_config
    );

    await ctx.runMutation(internal.domain.runs.experiments_repo.insertExperimentEvidences, {
      experiment_id,
      evidence_ids: args.evidence_ids,
    });

    return experiment_id;
  },
});
