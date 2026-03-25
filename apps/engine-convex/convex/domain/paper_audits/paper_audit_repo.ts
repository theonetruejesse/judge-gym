import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import { PaperAuditPackagesTableSchema } from "../../models/paper_audits";

const CreatePaperAuditPackageArgsSchema = PaperAuditPackagesTableSchema.pick({
  package_tag: true,
  target_key: true,
  title: true,
  description: true,
  default_compatibility_mode: true,
  default_evidence_view: true,
  rubric_source_kind: true,
  task_contract: true,
  output_contract: true,
  rubric_seed: true,
  rubric_critic_seed: true,
  score_prompt: true,
  provenance_json: true,
  metadata_json: true,
  source_manifest_asset_id: true,
}).extend({
  package_tag: PaperAuditPackagesTableSchema.shape.package_tag.optional(),
  status: PaperAuditPackagesTableSchema.shape.status.optional(),
});

function buildNow() {
  return Date.now();
}

function resolveCreateArgs(
  args: z.infer<typeof CreatePaperAuditPackageArgsSchema>,
) {
  return {
    package_tag: args.package_tag,
    target_key: args.target_key,
    title: args.title,
    description: args.description ?? null,
    default_compatibility_mode: args.default_compatibility_mode,
    default_evidence_view: args.default_evidence_view,
    rubric_source_kind: args.rubric_source_kind,
    task_contract: args.task_contract,
    output_contract: args.output_contract,
    rubric_seed: args.rubric_seed ?? null,
    rubric_critic_seed: args.rubric_critic_seed ?? null,
    score_prompt: args.score_prompt,
    provenance_json: args.provenance_json ?? null,
    metadata_json: args.metadata_json ?? null,
    source_manifest_asset_id: args.source_manifest_asset_id ?? null,
    status: args.status ?? "start",
  };
}

export const createPackage = zInternalMutation({
  args: CreatePaperAuditPackageArgsSchema,
  returns: zid("paper_audit_packages"),
  handler: async (ctx, args) => {
    if (!args.package_tag) {
      throw new Error("package_tag is required");
    }
    const now = buildNow();
    return ctx.db.insert("paper_audit_packages", {
      ...resolveCreateArgs(args),
      package_tag: args.package_tag,
      created_at_ms: now,
      updated_at_ms: now,
    });
  },
});

export const upsertPackageByTag = zInternalMutation({
  args: CreatePaperAuditPackageArgsSchema.extend({
    package_tag: PaperAuditPackagesTableSchema.shape.package_tag,
  }),
  returns: z.object({
    package_id: zid("paper_audit_packages"),
    action: z.enum(["created", "updated", "unchanged"]),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paper_audit_packages")
      .withIndex("by_package_tag", (q) => q.eq("package_tag", args.package_tag))
      .first();
    const resolved = resolveCreateArgs(args);
    const nextComparable = JSON.stringify({
      ...resolved,
      package_tag: args.package_tag,
    });

    if (!existing) {
      const now = buildNow();
      const package_id = await ctx.db.insert("paper_audit_packages", {
        ...resolved,
        package_tag: args.package_tag,
        created_at_ms: now,
        updated_at_ms: now,
      });
      return { package_id, action: "created" as const };
    }

    const currentComparable = JSON.stringify({
      package_tag: existing.package_tag,
      target_key: existing.target_key,
      title: existing.title,
      description: existing.description ?? null,
      default_compatibility_mode: existing.default_compatibility_mode,
      default_evidence_view: existing.default_evidence_view,
      rubric_source_kind: existing.rubric_source_kind,
      task_contract: existing.task_contract,
      output_contract: existing.output_contract,
      rubric_seed: existing.rubric_seed ?? null,
      rubric_critic_seed: existing.rubric_critic_seed ?? null,
      score_prompt: existing.score_prompt,
      provenance_json: existing.provenance_json ?? null,
      metadata_json: existing.metadata_json ?? null,
      source_manifest_asset_id: existing.source_manifest_asset_id ?? null,
      status: existing.status,
    });
    if (currentComparable === nextComparable) {
      return { package_id: existing._id, action: "unchanged" as const };
    }

    await ctx.db.patch(existing._id, {
      ...resolved,
      updated_at_ms: buildNow(),
    });
    return { package_id: existing._id, action: "updated" as const };
  },
});

export const getPackage = zInternalQuery({
  args: z.object({
    package_id: zid("paper_audit_packages"),
  }),
  returns: PaperAuditPackagesTableSchema.extend({
    _id: zid("paper_audit_packages"),
    _creationTime: z.number(),
  }).nullable(),
  handler: async (ctx, args) => {
    return ctx.db.get(args.package_id);
  },
});

export const getPackageByTag = zInternalQuery({
  args: z.object({
    package_tag: z.string(),
  }),
  returns: PaperAuditPackagesTableSchema.extend({
    _id: zid("paper_audit_packages"),
    _creationTime: z.number(),
  }).nullable(),
  handler: async (ctx, args) => {
    return ctx.db
      .query("paper_audit_packages")
      .withIndex("by_package_tag", (q) => q.eq("package_tag", args.package_tag))
      .first();
  },
});

export const listPackages = zInternalQuery({
  args: z.object({}),
  returns: z.array(PaperAuditPackagesTableSchema.extend({
    _id: zid("paper_audit_packages"),
    _creationTime: z.number(),
  })),
  handler: async (ctx) => {
    const rows = await ctx.db.query("paper_audit_packages").collect();
    return rows.sort((left, right) => left.package_tag.localeCompare(right.package_tag));
  },
});

