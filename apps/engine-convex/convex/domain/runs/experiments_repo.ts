import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "../../_generated/dataModel";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { ExperimentsTableSchema } from "../../models/experiments";
import { buildRandomTag } from "../../utils/tags";
import { internal } from "../../_generated/api";

export const CreateExperimentArgsSchema = ExperimentsTableSchema.pick({
  experiment_tag: true,
  study_kind: true,
  evidence_source_kind: true,
  evidence_set_id: true,
  paper_audit_package_id: true,
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
): {
  experiment_tag: string;
  study_kind: z.infer<typeof ExperimentsTableSchema.shape.study_kind>;
  evidence_source_kind: z.infer<typeof ExperimentsTableSchema.shape.evidence_source_kind>;
  evidence_set_id: z.infer<typeof ExperimentsTableSchema.shape.evidence_set_id>;
  paper_audit_package_id: z.infer<typeof ExperimentsTableSchema.shape.paper_audit_package_id>;
  rubric_source_kind: z.infer<typeof ExperimentsTableSchema.shape.rubric_source_kind>;
  compatibility_mode: z.infer<typeof ExperimentsTableSchema.shape.compatibility_mode>;
  task_contract: z.infer<typeof ExperimentsTableSchema.shape.task_contract>;
  output_contract: z.infer<typeof ExperimentsTableSchema.shape.output_contract>;
  rubric_config: z.infer<typeof ExperimentsTableSchema.shape.rubric_config>;
  scoring_config: z.infer<typeof ExperimentsTableSchema.shape.scoring_config>;
} {
  const evidenceSourceKind = args.evidence_source_kind
    ?? "evidence_set";
  const studyKind = args.study_kind
    ?? "paper_audit";
  return {
    experiment_tag: args.experiment_tag ?? buildRandomTag(),
    study_kind: studyKind,
    evidence_source_kind: evidenceSourceKind,
    evidence_set_id: args.evidence_set_id,
    paper_audit_package_id: args.paper_audit_package_id ?? null,
    rubric_source_kind: args.rubric_source_kind ?? "generate",
    compatibility_mode: args.compatibility_mode ?? "native",
    task_contract: args.task_contract ?? {
      task_kind: "stage_judgment" as const,
      label_space_json: null,
      instructions_json: null,
      prompt_template_id: null,
    },
    output_contract: args.output_contract ?? {
      kind: "verdict_line" as const,
      schema_version: "v1",
      parser_key: args.scoring_config.method === "subset"
        ? "subset_verdict"
        : "single_verdict",
    },
    rubric_config: args.rubric_config,
    scoring_config: args.scoring_config,
  };
}

function buildComparableExperimentShape(args: {
  experiment_tag: string;
  study_kind: z.infer<typeof ExperimentsTableSchema.shape.study_kind>;
  evidence_source_kind: z.infer<typeof ExperimentsTableSchema.shape.evidence_source_kind>;
  evidence_set_id: z.infer<typeof ExperimentsTableSchema.shape.evidence_set_id>;
  paper_audit_package_id: z.infer<typeof ExperimentsTableSchema.shape.paper_audit_package_id>;
  rubric_source_kind: z.infer<typeof ExperimentsTableSchema.shape.rubric_source_kind>;
  compatibility_mode: z.infer<typeof ExperimentsTableSchema.shape.compatibility_mode>;
  task_contract: z.infer<typeof ExperimentsTableSchema.shape.task_contract>;
  output_contract: z.infer<typeof ExperimentsTableSchema.shape.output_contract>;
  rubric_config: z.infer<typeof ExperimentsTableSchema.shape.rubric_config>;
  scoring_config: z.infer<typeof ExperimentsTableSchema.shape.scoring_config>;
}) {
  return JSON.stringify(args);
}

export const createExperiment: ReturnType<typeof zInternalMutation> = zInternalMutation({
  args: CreateExperimentArgsSchema,
  returns: zid("experiments"),
  handler: async (ctx, args): Promise<Id<"experiments">> => {
    const resolvedBase = resolveCreateArgs(args);
    if (resolvedBase.evidence_source_kind !== "evidence_set") {
      throw new Error("Greenfield V4 experiments only support evidence_set sources");
    }
    if (!resolvedBase.evidence_set_id) {
      throw new Error("Evidence-set-backed experiments require evidence_set_id");
    }
    let packageRow = null;
    if (resolvedBase.paper_audit_package_id) {
      packageRow = await ctx.runQuery(
        internal.domain.paper_audits.paper_audit_repo.getPackage,
        { package_id: resolvedBase.paper_audit_package_id },
      );
      if (!packageRow) {
        throw new Error("Paper-audit package not found");
      }
    }
    const resolved: ReturnType<typeof resolveCreateArgs> = {
      ...resolvedBase,
      rubric_source_kind:
        args.rubric_source_kind
        ?? packageRow?.rubric_source_kind
        ?? resolvedBase.rubric_source_kind,
      compatibility_mode:
        args.compatibility_mode
        ?? packageRow?.default_compatibility_mode
        ?? resolvedBase.compatibility_mode,
      task_contract:
        args.task_contract
        ?? packageRow?.task_contract
        ?? resolvedBase.task_contract,
      output_contract:
        args.output_contract
        ?? packageRow?.output_contract
        ?? resolvedBase.output_contract,
    };
    const evidenceSet = await ctx.db.get(resolved.evidence_set_id!);
    if (!evidenceSet) {
      throw new Error("Evidence set not found");
    }
    return ctx.db.insert("experiments", {
      ...resolved,
      total_count: 0,
    });
  },
});

export const upsertExperimentByTag: ReturnType<typeof zInternalMutation> = zInternalMutation({
  args: CreateExperimentArgsSchema.extend({
    experiment_tag: ExperimentsTableSchema.shape.experiment_tag,
    force_reconfigure: z.boolean().default(false),
  }),
  returns: z.object({
    experiment_id: zid("experiments"),
    action: z.enum(["created", "updated", "unchanged", "conflict"]),
  }),
  handler: async (ctx, args): Promise<{
    experiment_id: Id<"experiments">;
    action: "created" | "updated" | "unchanged" | "conflict";
  }> => {
    const resolvedBase = resolveCreateArgs(args);
    if (resolvedBase.evidence_source_kind !== "evidence_set") {
      throw new Error("Greenfield V4 experiments only support evidence_set sources");
    }
    if (!resolvedBase.evidence_set_id) {
      throw new Error("Evidence-set-backed experiments require evidence_set_id");
    }
    let packageRow = null;
    if (resolvedBase.paper_audit_package_id) {
      packageRow = await ctx.runQuery(
        internal.domain.paper_audits.paper_audit_repo.getPackage,
        { package_id: resolvedBase.paper_audit_package_id },
      );
      if (!packageRow) {
        throw new Error("Paper-audit package not found");
      }
    }
    const resolved: ReturnType<typeof resolveCreateArgs> = {
      ...resolvedBase,
      rubric_source_kind:
        args.rubric_source_kind
        ?? packageRow?.rubric_source_kind
        ?? resolvedBase.rubric_source_kind,
      compatibility_mode:
        args.compatibility_mode
        ?? packageRow?.default_compatibility_mode
        ?? resolvedBase.compatibility_mode,
      task_contract:
        args.task_contract
        ?? packageRow?.task_contract
        ?? resolvedBase.task_contract,
      output_contract:
        args.output_contract
        ?? packageRow?.output_contract
        ?? resolvedBase.output_contract,
    };
    const evidenceSet = await ctx.db.get(resolved.evidence_set_id!);
    if (!evidenceSet) {
      throw new Error("Evidence set not found");
    }

    const existing = await ctx.db
      .query("experiments")
      .withIndex("by_experiment_tag", (q) => q.eq("experiment_tag", args.experiment_tag))
      .first();
    if (!existing) {
      const experiment_id: Id<"experiments"> = await ctx.db.insert("experiments", {
        ...resolved,
        experiment_tag: args.experiment_tag,
        total_count: 0,
      });
      return {
        experiment_id,
        action: "created" as const,
      };
    }

    const nextComparable = buildComparableExperimentShape({
      experiment_tag: args.experiment_tag,
      study_kind: resolved.study_kind,
      evidence_source_kind: resolved.evidence_source_kind,
      evidence_set_id: resolved.evidence_set_id,
      paper_audit_package_id: resolved.paper_audit_package_id,
      rubric_source_kind: resolved.rubric_source_kind,
      compatibility_mode: resolved.compatibility_mode,
      task_contract: resolved.task_contract,
      output_contract: resolved.output_contract,
      rubric_config: resolved.rubric_config,
      scoring_config: resolved.scoring_config,
    });
    const currentComparable = buildComparableExperimentShape({
      experiment_tag: existing.experiment_tag,
      study_kind: existing.study_kind,
      evidence_source_kind: existing.evidence_source_kind,
      evidence_set_id: existing.evidence_set_id,
      paper_audit_package_id: existing.paper_audit_package_id,
      rubric_source_kind: existing.rubric_source_kind,
      compatibility_mode: existing.compatibility_mode,
      task_contract: existing.task_contract,
      output_contract: existing.output_contract,
      rubric_config: existing.rubric_config,
      scoring_config: existing.scoring_config,
    });
    const unchanged = currentComparable === nextComparable;
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
