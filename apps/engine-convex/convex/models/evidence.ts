import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { StateStatusSchema } from "./_shared";

export const EvidenceUniverseKindSchema = z.enum([
  "news",
  "paper_audit",
  "benchmark",
  "mixed",
]);

export const DiscoveryProviderSchema = z.enum([
  "mediacloud",
  "manual",
]);

export const HydratorKindSchema = z.enum([
  "firecrawl",
  "manual",
  "none",
]);

export const EvidenceAssetRoleSchema = z.enum([
  "provider_payload",
  "raw_html",
  "raw_text",
  "view_text",
]);

export const EvidenceHydrationStatusSchema = z.enum([
  "pending",
  "hydrated",
  "failed",
]);

export const EvidenceUniverseTableSchema = z.object({
  universe_tag: z.string(),
  kind: EvidenceUniverseKindSchema,
  title: z.string(),
  description: z.string().nullable().optional(),
  citation_json: z.string().nullable().optional(),
  license_json: z.string().nullable().optional(),
  default_locale: z.string().nullable().optional(),
  status: StateStatusSchema,
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const AcquisitionSpecsTableSchema = z.object({
  universe_id: zid("evidence_universes"),
  spec_tag: z.string(),
  discovery_provider: DiscoveryProviderSchema,
  discovery_config_json: z.string(),
  hydrator_kind: HydratorKindSchema,
  hydrator_config_json: z.string().nullable().optional(),
  active: z.boolean(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const AcquisitionRunsTableSchema = z.object({
  acquisition_spec_id: zid("acquisition_specs"),
  status: StateStatusSchema,
  cursor_json: z.string().nullable().optional(),
  discovered_count: z.number(),
  hydrated_count: z.number(),
  error_count: z.number(),
  workflow_id: z.string().nullable().optional(),
  workflow_run_id: z.string().nullable().optional(),
  last_error_message: z.string().nullable().optional(),
  started_at_ms: z.number().nullable().optional(),
  finished_at_ms: z.number().nullable().optional(),
});

export const EvidenceAssetsTableSchema = z.object({
  storage_id: z.string(),
  role: EvidenceAssetRoleSchema,
  mime_type: z.string(),
  encoding: z.string().nullable().optional(),
  compression: z.string().nullable().optional(),
  byte_size: z.number(),
  content_hash: z.string(),
  created_at_ms: z.number(),
});

export const EvidenceCandidatesTableSchema = z.object({
  universe_id: zid("evidence_universes"),
  acquisition_run_id: zid("acquisition_runs"),
  discovery_provider: DiscoveryProviderSchema,
  external_id: z.string(),
  url: z.string(),
  title: z.string().nullable().optional(),
  publish_date: z.string().nullable().optional(),
  indexed_date: z.string().nullable().optional(),
  media_name: z.string().nullable().optional(),
  media_url: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  metadata_json: z.string().nullable().optional(),
  provider_payload_asset_id: zid("evidence_assets").nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const EvidenceItemsTableSchema = z.object({
  universe_id: zid("evidence_universes"),
  candidate_id: zid("evidence_candidates").nullable().optional(),
  canonical_key: z.string(),
  hydration_status: EvidenceHydrationStatusSchema,
  raw_text_asset_id: zid("evidence_assets").nullable().optional(),
  raw_html_asset_id: zid("evidence_assets").nullable().optional(),
  content_hash: z.string().nullable().optional(),
  char_count: z.number().nullable().optional(),
  token_estimate: z.number().nullable().optional(),
  extraction_version: z.string().nullable().optional(),
  metadata_json: z.string().nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const EvidenceViewsTableSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  view_kind: z.string(),
  pipeline_kind: z.string(),
  pipeline_version: z.string(),
  asset_id: zid("evidence_assets").nullable().optional(),
  status: StateStatusSchema,
  attempt_id: zid("llm_attempts").nullable().optional(),
  metadata_json: z.string().nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});
