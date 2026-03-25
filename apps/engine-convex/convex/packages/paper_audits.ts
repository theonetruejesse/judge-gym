import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Id } from "../_generated/dataModel";
import { zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import { PaperAuditPackagesTableSchema } from "../models/paper_audits";

const PaperAuditPackageInputSchema = PaperAuditPackagesTableSchema.pick({
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

const PaperAuditPackageResultSchema = PaperAuditPackagesTableSchema.extend({
  package_id: zid("paper_audit_packages"),
});

export const upsertPaperAuditPackage: ReturnType<typeof zMutation> = zMutation({
  args: PaperAuditPackageInputSchema.extend({
    package_tag: PaperAuditPackagesTableSchema.shape.package_tag,
  }),
  returns: z.object({
    package_id: zid("paper_audit_packages"),
    action: z.enum(["created", "updated", "unchanged"]),
  }),
  handler: async (ctx, args): Promise<{
    package_id: Id<"paper_audit_packages">;
    action: "created" | "updated" | "unchanged";
  }> => {
    return ctx.runMutation(
      internal.domain.paper_audits.paper_audit_repo.upsertPackageByTag,
      args,
    );
  },
});

export const getPaperAuditPackage: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    package_id: zid("paper_audit_packages"),
  }),
  returns: PaperAuditPackageResultSchema.nullable(),
  handler: async (ctx, args): Promise<z.infer<typeof PaperAuditPackageResultSchema> | null> => {
    const row = await ctx.runQuery(
      internal.domain.paper_audits.paper_audit_repo.getPackage,
      args,
    );
    if (!row) {
      return null;
    }
    return {
      package_id: row._id,
      package_tag: row.package_tag,
      target_key: row.target_key,
      title: row.title,
      description: row.description ?? null,
      default_compatibility_mode: row.default_compatibility_mode,
      default_evidence_view: row.default_evidence_view,
      rubric_source_kind: row.rubric_source_kind,
      task_contract: row.task_contract,
      output_contract: row.output_contract,
      rubric_seed: row.rubric_seed ?? null,
      rubric_critic_seed: row.rubric_critic_seed ?? null,
      score_prompt: row.score_prompt,
      provenance_json: row.provenance_json ?? null,
      metadata_json: row.metadata_json ?? null,
      source_manifest_asset_id: row.source_manifest_asset_id ?? null,
      status: row.status,
      created_at_ms: row.created_at_ms,
      updated_at_ms: row.updated_at_ms,
    };
  },
});

export const listPaperAuditPackages: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(
    z.object({
      package_id: zid("paper_audit_packages"),
      package_tag: z.string(),
      target_key: PaperAuditPackagesTableSchema.shape.target_key,
      title: z.string(),
      description: z.string().nullable(),
      default_compatibility_mode: PaperAuditPackagesTableSchema.shape.default_compatibility_mode,
      default_evidence_view: PaperAuditPackagesTableSchema.shape.default_evidence_view,
      rubric_source_kind: PaperAuditPackagesTableSchema.shape.rubric_source_kind,
      status: PaperAuditPackagesTableSchema.shape.status,
      created_at_ms: z.number(),
      updated_at_ms: z.number(),
    }),
  ),
  handler: async (ctx): Promise<Array<{
    package_id: Id<"paper_audit_packages">;
    package_tag: string;
    target_key: z.infer<typeof PaperAuditPackagesTableSchema.shape.target_key>;
    title: string;
    description: string | null;
    default_compatibility_mode: z.infer<typeof PaperAuditPackagesTableSchema.shape.default_compatibility_mode>;
    default_evidence_view: z.infer<typeof PaperAuditPackagesTableSchema.shape.default_evidence_view>;
    rubric_source_kind: z.infer<typeof PaperAuditPackagesTableSchema.shape.rubric_source_kind>;
    status: z.infer<typeof PaperAuditPackagesTableSchema.shape.status>;
    created_at_ms: number;
    updated_at_ms: number;
  }>> => {
    const rows = await ctx.runQuery(
      internal.domain.paper_audits.paper_audit_repo.listPackages,
      {},
    );
    return rows.map((row: (typeof rows)[number]) => ({
      package_id: row._id,
      package_tag: row.package_tag,
      target_key: row.target_key,
      title: row.title,
      description: row.description ?? null,
      default_compatibility_mode: row.default_compatibility_mode,
      default_evidence_view: row.default_evidence_view,
      rubric_source_kind: row.rubric_source_kind,
      status: row.status,
      created_at_ms: row.created_at_ms,
      updated_at_ms: row.updated_at_ms,
    }));
  },
});
