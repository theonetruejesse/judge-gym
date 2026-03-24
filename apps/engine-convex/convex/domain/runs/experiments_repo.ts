import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { buildRandomTag } from "../../utils/tags";

export const CreateExperimentArgsSchema = ExperimentsTableSchema.pick({
  experiment_tag: true,
  study_kind: true,
  evidence_source_kind: true,
  evidence_set_id: true,
  rubric_source_kind: true,
  compatibility_mode: true,
  task_contract: true,
  output_contract: true,
  rubric_config: true,
  scoring_config: true,
}).extend({
  experiment_tag: ExperimentsTableSchema.shape.experiment_tag.optional(),
  study_kind: ExperimentsTableSchema.shape.study_kind.optional(),
  evidence_source_kind: ExperimentsTableSchema.shape.evidence_source_kind.optional(),
  rubric_source_kind: ExperimentsTableSchema.shape.rubric_source_kind.optional(),
  compatibility_mode: ExperimentsTableSchema.shape.compatibility_mode.optional(),
  task_contract: ExperimentsTableSchema.shape.task_contract.optional(),
  output_contract: ExperimentsTableSchema.shape.output_contract.optional(),
});

function resolveCreateArgs(
  args: z.infer<typeof CreateExperimentArgsSchema>,
) {
  const evidenceSourceKind = args.evidence_source_kind
    ?? "evidence_set";
  const studyKind = args.study_kind
    ?? "paper_audit";
  const rubricSourceKind = args.rubric_source_kind ?? "generate";
  const compatibilityMode = args.compatibility_mode ?? "native";
  const taskContract = args.task_contract ?? {
    task_kind: "stage_judgment" as const,
    label_space_json: null,
    instructions_json: null,
    prompt_template_id: null,
  };
  const outputContract = args.output_contract ?? {
    kind: "verdict_line" as const,
    schema_version: "v1",
    parser_key: args.scoring_config.method === "subset"
      ? "subset_verdict"
      : "single_verdict",
  };

  if (evidenceSourceKind !== "evidence_set") {
    throw new Error("Greenfield V4 experiments only support evidence_set sources");
  }
  if (!args.evidence_set_id) {
    throw new Error("Evidence-set-backed experiments require evidence_set_id");
  }

  return {
    experiment_tag: args.experiment_tag ?? buildRandomTag(),
    study_kind: studyKind,
    evidence_source_kind: evidenceSourceKind,
    evidence_set_id: args.evidence_set_id,
    rubric_source_kind: rubricSourceKind,
    compatibility_mode: compatibilityMode,
    task_contract: taskContract,
    output_contract: outputContract,
    rubric_config: args.rubric_config,
    scoring_config: args.scoring_config,
  };
}

export const createExperiment = zInternalMutation({
  args: CreateExperimentArgsSchema,
  returns: zid("experiments"),
  handler: async (ctx, args) => {
    const resolved = resolveCreateArgs(args);
    const evidenceSet = await ctx.db.get(resolved.evidence_set_id);
    if (!evidenceSet) {
      throw new Error("Evidence set not found");
    }
    return ctx.db.insert("experiments", {
      ...resolved,
      total_count: 0,
    });
  },
});

export const upsertExperimentByTag = zInternalMutation({
  args: CreateExperimentArgsSchema.extend({
    experiment_tag: ExperimentsTableSchema.shape.experiment_tag,
    force_reconfigure: z.boolean().default(false),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
    action: z.enum(["created", "updated", "unchanged", "conflict"]),
  }),
  handler: async (ctx, args) => {
    const resolved = resolveCreateArgs(args);
    const evidenceSet = await ctx.db.get(resolved.evidence_set_id);
    if (!evidenceSet) {
      throw new Error("Evidence set not found");
    }

    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experiment_tag", args.experiment_tag))
      .first();
    if (!existing) {
      const experiment_id = await ctx.db.insert("experiments", {
        ...resolved,
        experiment_tag: args.experiment_tag,
        total_count: 0,
      });
      return {
        experiment_id,
        action: "created" as const,
      };
    }

    const unchanged = existing.study_kind === resolved.study_kind
      && existing.evidence_source_kind === resolved.evidence_source_kind
      && existing.evidence_set_id === resolved.evidence_set_id
      && existing.rubric_source_kind === resolved.rubric_source_kind
      && existing.compatibility_mode === resolved.compatibility_mode
      && JSON.stringify(existing.task_contract) === JSON.stringify(resolved.task_contract)
      && JSON.stringify(existing.output_contract) === JSON.stringify(resolved.output_contract)
      && JSON.stringify(existing.rubric_config) === JSON.stringify(resolved.rubric_config)
      && JSON.stringify(existing.scoring_config) === JSON.stringify(resolved.scoring_config);
    if (unchanged) {
      return {
        experiment_id: existing._id,
        action: "unchanged" as const,
      };
    }

    if (!args.force_reconfigure && existing.total_count > 0) {
      return {
        experiment_id: existing._id,
        action: "conflict" as const,
      };
    }

    await ctx.db.patch(existing._id, {
      ...resolved,
    });
    return {
      experiment_id: existing._id,
      action: "updated" as const,
    };
  },
});

export const patchExperiment = zInternalMutation({
  args: z.object({
    experiment_id: zid("experiments"),
    patch: z.object({
      total_count: ExperimentsTableSchema.shape.total_count.optional(),
    }),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.experiment_id, args.patch);
    return null;
  },
});
