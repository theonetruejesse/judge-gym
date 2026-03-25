import z from "zod";
import {
  PaperAuditPackageSchema,
} from "@judge-gym/engine-prompts";
import { zid } from "convex-helpers/server/zod4";
import { StateStatusSchema } from "./_shared";

export const PaperAuditPackagesTableSchema = PaperAuditPackageSchema.extend({
  source_manifest_asset_id: zid("evidence_assets").nullable().optional(),
  status: StateStatusSchema,
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

