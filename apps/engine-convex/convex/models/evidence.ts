import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { modelTypeSchema } from "@judge-gym/engine-settings/provider";
import { EvidenceTransformStageKeySchema } from "@judge-gym/engine-settings/process";
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
  "manual",
  "none",
]);

export const EvidenceAssetRoleSchema = z.enum([
  "provider_payload",
  "raw_html",
  "raw_text",
  "view_text",
]);

export const EvidenceSourceRecordKindSchema = z.enum([
  "source_text",
  "source_html",
  "paper_original",
]);

export const EvidenceSetSourceKindSchema = z.enum([
  "universe_slice",
  "manual_import",
  "literature_dataset",
]);

export const EvidenceQualityLabelSchema = z.enum([
  "unknown",
  "high",
  "medium",
  "low",
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
  title: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  source_name: z.string().nullable().optional(),
  publish_date: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  hydration_status: EvidenceHydrationStatusSchema,
  metadata_json: z.string().nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const EvidenceSourceRecordsTableSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  record_kind: EvidenceSourceRecordKindSchema,
  asset_id: zid("evidence_assets"),
  is_primary: z.boolean(),
  content_hash: z.string().nullable().optional(),
  char_count: z.number().nullable().optional(),
  token_estimate: z.number().nullable().optional(),
  pipeline_kind: z.string(),
  pipeline_version: z.string(),
  metadata_json: z.string().nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const EvidenceSetsTableSchema = z.object({
  universe_id: zid("evidence_universes"),
  evidence_set_tag: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  source_kind: EvidenceSetSourceKindSchema,
  quality_label: EvidenceQualityLabelSchema,
  selection_config_json: z.string().nullable().optional(),
  item_count: z.number(),
  status: StateStatusSchema,
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});

export const EvidenceSetItemsTableSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  evidence_item_id: zid("evidence_items"),
  pinned_source_record_id: zid("evidence_source_records").nullable().optional(),
  pinned_view_id: zid("evidence_views").nullable().optional(),
  ordinal: z.number(),
  inclusion_reason: z.string().nullable().optional(),
  quality_label: EvidenceQualityLabelSchema,
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

export const EvidenceTransformSourceRecordKindSchema = z.enum([
  "source_text",
  "paper_original",
]);

export const EvidenceTransformRunsTableSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  source_record_kind: EvidenceTransformSourceRecordKindSchema,
  target_view_kinds: z.array(EvidenceTransformStageKeySchema),
  model: modelTypeSchema,
  prompt_version: z.string(),
  status: StateStatusSchema,
  workflow_id: z.string().nullable().optional(),
  workflow_run_id: z.string().nullable().optional(),
  current_stage: EvidenceTransformStageKeySchema.nullable().optional(),
  total_count: z.number(),
  completed_count: z.number(),
  failed_count: z.number(),
  last_error_message: z.string().nullable().optional(),
  started_at_ms: z.number().nullable().optional(),
  finished_at_ms: z.number().nullable().optional(),
  created_at_ms: z.number(),
  updated_at_ms: z.number(),
});
