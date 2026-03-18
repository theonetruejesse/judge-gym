import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import {
  BundleStrategySchema,
  SemanticLevelSchema,
} from "./_shared";

export const BundlePlanStatusSchema = z.enum([
  "ready",
]);

export const BundlePlansTableSchema = z.object({
  bundle_plan_tag: z.string(),
  pool_id: zid("pools"),
  strategy: BundleStrategySchema,
  strategy_version: z.string(),
  source_view: SemanticLevelSchema.nullable(),
  bundle_size: z.number().int().min(1),
  seed: z.number().int().nullable(),
  evidence_count: z.number().int().nonnegative(),
  bundle_count: z.number().int().nonnegative(),
  status: BundlePlanStatusSchema,
});

export const BundlePlanItemsTableSchema = z.object({
  bundle_plan_id: zid("bundle_plans"),
  bundle_index: z.number().int().nonnegative(),
  evidence_id: zid("evidences"),
  window_id: zid("windows"),
  position: z.number().int().nonnegative(),
  cluster_id: z.string().nullable(),
  bundle_signature: z.string(),
});
