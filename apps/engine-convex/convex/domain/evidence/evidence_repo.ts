import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalMutation, zInternalQuery } from "../../utils/custom_fns";
import type { Id } from "../../_generated/dataModel";
import {
  AcquisitionRunsTableSchema,
  AcquisitionSpecsTableSchema,
  EvidenceAssetsTableSchema,
  EvidenceCandidatesTableSchema,
  EvidenceHydrationStatusSchema,
  EvidenceItemsTableSchema,
  EvidenceSetItemsTableSchema,
  EvidenceSetsTableSchema,
  EvidenceUniverseTableSchema,
  EvidenceViewsTableSchema,
} from "../../models/evidence";

const CreateUniverseArgsSchema = z.object({
  universe_tag: EvidenceUniverseTableSchema.shape.universe_tag,
  kind: EvidenceUniverseTableSchema.shape.kind,
  title: EvidenceUniverseTableSchema.shape.title,
  description: EvidenceUniverseTableSchema.shape.description.optional(),
  citation_json: EvidenceUniverseTableSchema.shape.citation_json.optional(),
  license_json: EvidenceUniverseTableSchema.shape.license_json.optional(),
  default_locale: EvidenceUniverseTableSchema.shape.default_locale.optional(),
});

const CreateAcquisitionSpecArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  spec_tag: AcquisitionSpecsTableSchema.shape.spec_tag,
  discovery_provider: AcquisitionSpecsTableSchema.shape.discovery_provider,
  discovery_config_json: AcquisitionSpecsTableSchema.shape.discovery_config_json,
  hydrator_kind: AcquisitionSpecsTableSchema.shape.hydrator_kind,
  hydrator_config_json: AcquisitionSpecsTableSchema.shape.hydrator_config_json.optional(),
  active: AcquisitionSpecsTableSchema.shape.active.optional(),
});

const CreateAcquisitionRunArgsSchema = z.object({
  acquisition_spec_id: zid("acquisition_specs"),
  cursor_json: AcquisitionRunsTableSchema.shape.cursor_json.optional(),
  workflow_id: AcquisitionRunsTableSchema.shape.workflow_id.optional(),
  workflow_run_id: AcquisitionRunsTableSchema.shape.workflow_run_id.optional(),
});

const UpsertCandidateSchema = z.object({
  discovery_provider: EvidenceCandidatesTableSchema.shape.discovery_provider,
  external_id: EvidenceCandidatesTableSchema.shape.external_id,
  url: EvidenceCandidatesTableSchema.shape.url,
  title: EvidenceCandidatesTableSchema.shape.title.optional(),
  publish_date: EvidenceCandidatesTableSchema.shape.publish_date.optional(),
  indexed_date: EvidenceCandidatesTableSchema.shape.indexed_date.optional(),
  media_name: EvidenceCandidatesTableSchema.shape.media_name.optional(),
  media_url: EvidenceCandidatesTableSchema.shape.media_url.optional(),
  language: EvidenceCandidatesTableSchema.shape.language.optional(),
  metadata_json: EvidenceCandidatesTableSchema.shape.metadata_json.optional(),
  provider_payload_asset_id: EvidenceCandidatesTableSchema.shape.provider_payload_asset_id.optional(),
});

const UpsertCandidatesArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  acquisition_run_id: zid("acquisition_runs"),
  candidates: z.array(UpsertCandidateSchema),
});

const CreateAssetArgsSchema = z.object({
  storage_id: EvidenceAssetsTableSchema.shape.storage_id,
  role: EvidenceAssetsTableSchema.shape.role,
  mime_type: EvidenceAssetsTableSchema.shape.mime_type,
  encoding: EvidenceAssetsTableSchema.shape.encoding.optional(),
  compression: EvidenceAssetsTableSchema.shape.compression.optional(),
  byte_size: EvidenceAssetsTableSchema.shape.byte_size,
  content_hash: EvidenceAssetsTableSchema.shape.content_hash,
});

const UpsertItemFromCandidateArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  candidate_id: zid("evidence_candidates"),
  canonical_key: EvidenceItemsTableSchema.shape.canonical_key,
  title: EvidenceItemsTableSchema.shape.title.optional(),
  source_url: EvidenceItemsTableSchema.shape.source_url.optional(),
  source_name: EvidenceItemsTableSchema.shape.source_name.optional(),
  publish_date: EvidenceItemsTableSchema.shape.publish_date.optional(),
  language: EvidenceItemsTableSchema.shape.language.optional(),
  hydration_status: EvidenceHydrationStatusSchema,
  raw_text_asset_id: EvidenceItemsTableSchema.shape.raw_text_asset_id.optional(),
  raw_html_asset_id: EvidenceItemsTableSchema.shape.raw_html_asset_id.optional(),
  content_hash: EvidenceItemsTableSchema.shape.content_hash.optional(),
  char_count: EvidenceItemsTableSchema.shape.char_count.optional(),
  token_estimate: EvidenceItemsTableSchema.shape.token_estimate.optional(),
  extraction_version: EvidenceItemsTableSchema.shape.extraction_version.optional(),
  metadata_json: EvidenceItemsTableSchema.shape.metadata_json.optional(),
});

const UpsertImportedItemArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  canonical_key: EvidenceItemsTableSchema.shape.canonical_key,
  title: EvidenceItemsTableSchema.shape.title.optional(),
  source_url: EvidenceItemsTableSchema.shape.source_url.optional(),
  source_name: EvidenceItemsTableSchema.shape.source_name.optional(),
  publish_date: EvidenceItemsTableSchema.shape.publish_date.optional(),
  language: EvidenceItemsTableSchema.shape.language.optional(),
  hydration_status: EvidenceHydrationStatusSchema,
  raw_text_asset_id: EvidenceItemsTableSchema.shape.raw_text_asset_id.optional(),
  raw_html_asset_id: EvidenceItemsTableSchema.shape.raw_html_asset_id.optional(),
  content_hash: EvidenceItemsTableSchema.shape.content_hash.optional(),
  char_count: EvidenceItemsTableSchema.shape.char_count.optional(),
  token_estimate: EvidenceItemsTableSchema.shape.token_estimate.optional(),
  extraction_version: EvidenceItemsTableSchema.shape.extraction_version.optional(),
  metadata_json: EvidenceItemsTableSchema.shape.metadata_json.optional(),
});

const UpsertViewArgsSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  view_kind: EvidenceViewsTableSchema.shape.view_kind,
  pipeline_kind: EvidenceViewsTableSchema.shape.pipeline_kind,
  pipeline_version: EvidenceViewsTableSchema.shape.pipeline_version,
  asset_id: EvidenceViewsTableSchema.shape.asset_id.optional(),
  status: EvidenceViewsTableSchema.shape.status,
  attempt_id: EvidenceViewsTableSchema.shape.attempt_id.optional(),
  metadata_json: EvidenceViewsTableSchema.shape.metadata_json.optional(),
});

const CreateEvidenceSetArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  evidence_set_tag: EvidenceSetsTableSchema.shape.evidence_set_tag,
  title: EvidenceSetsTableSchema.shape.title,
  description: EvidenceSetsTableSchema.shape.description.optional(),
  source_kind: EvidenceSetsTableSchema.shape.source_kind,
  quality_label: EvidenceSetsTableSchema.shape.quality_label.optional(),
  selection_config_json: EvidenceSetsTableSchema.shape.selection_config_json.optional(),
  status: EvidenceSetsTableSchema.shape.status.optional(),
});

const UpsertEvidenceSetItemsArgsSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  items: z.array(z.object({
    evidence_item_id: EvidenceSetItemsTableSchema.shape.evidence_item_id,
    pinned_view_id: EvidenceSetItemsTableSchema.shape.pinned_view_id.optional(),
    ordinal: EvidenceSetItemsTableSchema.shape.ordinal.optional(),
    inclusion_reason: EvidenceSetItemsTableSchema.shape.inclusion_reason.optional(),
    quality_label: EvidenceSetItemsTableSchema.shape.quality_label.optional(),
    metadata_json: EvidenceSetItemsTableSchema.shape.metadata_json.optional(),
  })),
});

export const createUniverse = zInternalMutation({
  args: CreateUniverseArgsSchema,
  returns: z.object({
    universe_id: zid("evidence_universes"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const universe_id = await ctx.db.insert("evidence_universes", {
      universe_tag: args.universe_tag,
      kind: args.kind,
      title: args.title,
      description: args.description ?? null,
      citation_json: args.citation_json ?? null,
      license_json: args.license_json ?? null,
      default_locale: args.default_locale ?? null,
      status: "start",
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { universe_id };
  },
});

export const createAcquisitionSpec = zInternalMutation({
  args: CreateAcquisitionSpecArgsSchema,
  returns: z.object({
    acquisition_spec_id: zid("acquisition_specs"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const acquisition_spec_id = await ctx.db.insert("acquisition_specs", {
      universe_id: args.universe_id,
      spec_tag: args.spec_tag,
      discovery_provider: args.discovery_provider,
      discovery_config_json: args.discovery_config_json,
      hydrator_kind: args.hydrator_kind,
      hydrator_config_json: args.hydrator_config_json ?? null,
      active: args.active ?? true,
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { acquisition_spec_id };
  },
});

export const createAcquisitionRun = zInternalMutation({
  args: CreateAcquisitionRunArgsSchema,
  returns: z.object({
    acquisition_run_id: zid("acquisition_runs"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const acquisition_run_id = await ctx.db.insert("acquisition_runs", {
      acquisition_spec_id: args.acquisition_spec_id,
      status: "start",
      cursor_json: args.cursor_json ?? null,
      discovered_count: 0,
      hydrated_count: 0,
      error_count: 0,
      workflow_id: args.workflow_id ?? null,
      workflow_run_id: args.workflow_run_id ?? null,
      last_error_message: null,
      started_at_ms: now,
      finished_at_ms: null,
    });
    return { acquisition_run_id };
  },
});

export const patchAcquisitionRun = zInternalMutation({
  args: z.object({
    acquisition_run_id: zid("acquisition_runs"),
    status: AcquisitionRunsTableSchema.shape.status.optional(),
    cursor_json: AcquisitionRunsTableSchema.shape.cursor_json.optional(),
    discovered_count: AcquisitionRunsTableSchema.shape.discovered_count.optional(),
    hydrated_count: AcquisitionRunsTableSchema.shape.hydrated_count.optional(),
    error_count: AcquisitionRunsTableSchema.shape.error_count.optional(),
    last_error_message: AcquisitionRunsTableSchema.shape.last_error_message.optional(),
    finished_at_ms: AcquisitionRunsTableSchema.shape.finished_at_ms.optional(),
  }),
  returns: z.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    if (args.status !== undefined) patch.status = args.status;
    if (args.cursor_json !== undefined) patch.cursor_json = args.cursor_json;
    if (args.discovered_count !== undefined) patch.discovered_count = args.discovered_count;
    if (args.hydrated_count !== undefined) patch.hydrated_count = args.hydrated_count;
    if (args.error_count !== undefined) patch.error_count = args.error_count;
    if (args.last_error_message !== undefined) patch.last_error_message = args.last_error_message;
    if (args.finished_at_ms !== undefined) patch.finished_at_ms = args.finished_at_ms;
    await ctx.db.patch(args.acquisition_run_id, patch);
    return null;
  },
});

export const createAsset = zInternalMutation({
  args: CreateAssetArgsSchema,
  returns: z.object({
    asset_id: zid("evidence_assets"),
  }),
  handler: async (ctx, args) => {
    const asset_id = await ctx.db.insert("evidence_assets", {
      storage_id: args.storage_id,
      role: args.role,
      mime_type: args.mime_type,
      encoding: args.encoding ?? null,
      compression: args.compression ?? null,
      byte_size: args.byte_size,
      content_hash: args.content_hash,
      created_at_ms: Date.now(),
    });
    return { asset_id };
  },
});

export const upsertCandidates = zInternalMutation({
  args: UpsertCandidatesArgsSchema,
  returns: z.object({
    inserted: z.number(),
    updated: z.number(),
    total: z.number(),
    candidate_ids: z.array(zid("evidence_candidates")),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("evidence_candidates")
      .withIndex("by_universe_provider_external", (q) =>
        q.eq("universe_id", args.universe_id),
      )
      .collect();
    const existingByKey = new Map(
      existing.map((candidate) => [
        `${candidate.discovery_provider}:${candidate.external_id}`,
        candidate,
      ]),
    );

    const candidate_ids: Array<Id<"evidence_candidates">> = [];
    let inserted = 0;
    let updated = 0;

    for (const candidate of args.candidates) {
      const key = `${candidate.discovery_provider}:${candidate.external_id}`;
      const current = existingByKey.get(key);
      if (current) {
        await ctx.db.patch(current._id, {
          acquisition_run_id: args.acquisition_run_id,
          url: candidate.url,
          title: candidate.title ?? null,
          publish_date: candidate.publish_date ?? null,
          indexed_date: candidate.indexed_date ?? null,
          media_name: candidate.media_name ?? null,
          media_url: candidate.media_url ?? null,
          language: candidate.language ?? null,
          metadata_json: candidate.metadata_json ?? null,
          provider_payload_asset_id: candidate.provider_payload_asset_id ?? null,
          updated_at_ms: now,
        });
        candidate_ids.push(current._id);
        updated += 1;
        continue;
      }

      const candidate_id = await ctx.db.insert("evidence_candidates", {
        universe_id: args.universe_id,
        acquisition_run_id: args.acquisition_run_id,
        discovery_provider: candidate.discovery_provider,
        external_id: candidate.external_id,
        url: candidate.url,
        title: candidate.title ?? null,
        publish_date: candidate.publish_date ?? null,
        indexed_date: candidate.indexed_date ?? null,
        media_name: candidate.media_name ?? null,
        media_url: candidate.media_url ?? null,
        language: candidate.language ?? null,
        metadata_json: candidate.metadata_json ?? null,
        provider_payload_asset_id: candidate.provider_payload_asset_id ?? null,
        created_at_ms: now,
        updated_at_ms: now,
      });
      candidate_ids.push(candidate_id);
      inserted += 1;
    }

    return {
      inserted,
      updated,
      total: args.candidates.length,
      candidate_ids,
    };
  },
});

export const upsertItemFromCandidate = zInternalMutation({
  args: UpsertItemFromCandidateArgsSchema,
  returns: z.object({
    evidence_item_id: zid("evidence_items"),
    action: z.enum(["created", "updated"]),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("evidence_items")
      .withIndex("by_canonical_key", (q) => q.eq("canonical_key", args.canonical_key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        universe_id: args.universe_id,
        candidate_id: args.candidate_id,
        title: args.title ?? null,
        source_url: args.source_url ?? null,
        source_name: args.source_name ?? null,
        publish_date: args.publish_date ?? null,
        language: args.language ?? null,
        hydration_status: args.hydration_status,
        raw_text_asset_id: args.raw_text_asset_id ?? null,
        raw_html_asset_id: args.raw_html_asset_id ?? null,
        content_hash: args.content_hash ?? null,
        char_count: args.char_count ?? null,
        token_estimate: args.token_estimate ?? null,
        extraction_version: args.extraction_version ?? null,
        metadata_json: args.metadata_json ?? null,
        updated_at_ms: now,
      });
      return { evidence_item_id: existing._id, action: "updated" as const };
    }

    const evidence_item_id = await ctx.db.insert("evidence_items", {
      universe_id: args.universe_id,
      candidate_id: args.candidate_id,
      canonical_key: args.canonical_key,
      title: args.title ?? null,
      source_url: args.source_url ?? null,
      source_name: args.source_name ?? null,
      publish_date: args.publish_date ?? null,
      language: args.language ?? null,
      hydration_status: args.hydration_status,
      raw_text_asset_id: args.raw_text_asset_id ?? null,
      raw_html_asset_id: args.raw_html_asset_id ?? null,
      content_hash: args.content_hash ?? null,
      char_count: args.char_count ?? null,
      token_estimate: args.token_estimate ?? null,
      extraction_version: args.extraction_version ?? null,
      metadata_json: args.metadata_json ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { evidence_item_id, action: "created" as const };
  },
});

export const upsertImportedItem = zInternalMutation({
  args: UpsertImportedItemArgsSchema,
  returns: z.object({
    evidence_item_id: zid("evidence_items"),
    action: z.enum(["created", "updated"]),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("evidence_items")
      .withIndex("by_canonical_key", (q) => q.eq("canonical_key", args.canonical_key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        universe_id: args.universe_id,
        candidate_id: null,
        title: args.title ?? null,
        source_url: args.source_url ?? null,
        source_name: args.source_name ?? null,
        publish_date: args.publish_date ?? null,
        language: args.language ?? null,
        hydration_status: args.hydration_status,
        raw_text_asset_id: args.raw_text_asset_id ?? null,
        raw_html_asset_id: args.raw_html_asset_id ?? null,
        content_hash: args.content_hash ?? null,
        char_count: args.char_count ?? null,
        token_estimate: args.token_estimate ?? null,
        extraction_version: args.extraction_version ?? null,
        metadata_json: args.metadata_json ?? null,
        updated_at_ms: now,
      });
      return { evidence_item_id: existing._id, action: "updated" as const };
    }

    const evidence_item_id = await ctx.db.insert("evidence_items", {
      universe_id: args.universe_id,
      candidate_id: null,
      canonical_key: args.canonical_key,
      title: args.title ?? null,
      source_url: args.source_url ?? null,
      source_name: args.source_name ?? null,
      publish_date: args.publish_date ?? null,
      language: args.language ?? null,
      hydration_status: args.hydration_status,
      raw_text_asset_id: args.raw_text_asset_id ?? null,
      raw_html_asset_id: args.raw_html_asset_id ?? null,
      content_hash: args.content_hash ?? null,
      char_count: args.char_count ?? null,
      token_estimate: args.token_estimate ?? null,
      extraction_version: args.extraction_version ?? null,
      metadata_json: args.metadata_json ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { evidence_item_id, action: "created" as const };
  },
});

export const upsertView = zInternalMutation({
  args: UpsertViewArgsSchema,
  returns: z.object({
    evidence_view_id: zid("evidence_views"),
    action: z.enum(["created", "updated"]),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("evidence_views")
      .withIndex("by_item_view", (q) =>
        q.eq("evidence_item_id", args.evidence_item_id).eq("view_kind", args.view_kind),
      )
      .first();
    if (existing && existing.pipeline_version === args.pipeline_version) {
      await ctx.db.patch(existing._id, {
        pipeline_kind: args.pipeline_kind,
        asset_id: args.asset_id ?? null,
        status: args.status,
        attempt_id: args.attempt_id ?? null,
        metadata_json: args.metadata_json ?? null,
        updated_at_ms: now,
      });
      return { evidence_view_id: existing._id, action: "updated" as const };
    }

    const evidence_view_id = await ctx.db.insert("evidence_views", {
      evidence_item_id: args.evidence_item_id,
      view_kind: args.view_kind,
      pipeline_kind: args.pipeline_kind,
      pipeline_version: args.pipeline_version,
      asset_id: args.asset_id ?? null,
      status: args.status,
      attempt_id: args.attempt_id ?? null,
      metadata_json: args.metadata_json ?? null,
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { evidence_view_id, action: "created" as const };
  },
});

export const createEvidenceSet = zInternalMutation({
  args: CreateEvidenceSetArgsSchema,
  returns: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const evidence_set_id = await ctx.db.insert("evidence_sets", {
      universe_id: args.universe_id,
      evidence_set_tag: args.evidence_set_tag,
      title: args.title,
      description: args.description ?? null,
      source_kind: args.source_kind,
      quality_label: args.quality_label ?? "unknown",
      selection_config_json: args.selection_config_json ?? null,
      item_count: 0,
      status: args.status ?? "start",
      created_at_ms: now,
      updated_at_ms: now,
    });
    return { evidence_set_id };
  },
});

export const upsertEvidenceSetItems = zInternalMutation({
  args: UpsertEvidenceSetItemsArgsSchema,
  returns: z.object({
    inserted: z.number(),
    updated: z.number(),
    total: z.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingRows = await ctx.db
      .query("evidence_set_items")
      .withIndex("by_set", (q) => q.eq("evidence_set_id", args.evidence_set_id))
      .collect();
    const existingByItemId = new Map(
      existingRows.map((row) => [String(row.evidence_item_id), row]),
    );

    let inserted = 0;
    let updated = 0;

    for (const [index, item] of args.items.entries()) {
      const current = existingByItemId.get(String(item.evidence_item_id));
      const ordinal = item.ordinal ?? index;
      if (current) {
        await ctx.db.patch(current._id, {
          pinned_view_id: item.pinned_view_id ?? null,
          ordinal,
          inclusion_reason: item.inclusion_reason ?? null,
          quality_label: item.quality_label ?? "unknown",
          metadata_json: item.metadata_json ?? null,
          updated_at_ms: now,
        });
        updated += 1;
        continue;
      }

      await ctx.db.insert("evidence_set_items", {
        evidence_set_id: args.evidence_set_id,
        evidence_item_id: item.evidence_item_id,
        pinned_view_id: item.pinned_view_id ?? null,
        ordinal,
        inclusion_reason: item.inclusion_reason ?? null,
        quality_label: item.quality_label ?? "unknown",
        metadata_json: item.metadata_json ?? null,
        created_at_ms: now,
        updated_at_ms: now,
      });
      inserted += 1;
    }

    await ctx.db.patch(args.evidence_set_id, {
      item_count: existingRows.length + inserted,
      updated_at_ms: now,
    });

    return {
      inserted,
      updated,
      total: args.items.length,
    };
  },
});

export const getUniverse = zInternalQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.universe_id);
  },
});

export const getAcquisitionSpec = zInternalQuery({
  args: z.object({
    acquisition_spec_id: zid("acquisition_specs"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.acquisition_spec_id);
  },
});

export const getAcquisitionRun = zInternalQuery({
  args: z.object({
    acquisition_run_id: zid("acquisition_runs"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.acquisition_run_id);
  },
});

export const getCandidate = zInternalQuery({
  args: z.object({
    candidate_id: zid("evidence_candidates"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.candidate_id);
  },
});

export const getEvidenceSet = zInternalQuery({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.evidence_set_id);
  },
});

export const getItemByCandidate = zInternalQuery({
  args: z.object({
    candidate_id: zid("evidence_candidates"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_items")
      .withIndex("by_candidate", (q) => q.eq("candidate_id", args.candidate_id))
      .first();
  },
});

export const getAssetByContentHash = zInternalQuery({
  args: z.object({
    content_hash: EvidenceAssetsTableSchema.shape.content_hash,
    role: EvidenceAssetsTableSchema.shape.role.optional(),
  }),
  handler: async (ctx, args) => {
    const assets = await ctx.db
      .query("evidence_assets")
      .withIndex("by_content_hash", (q) => q.eq("content_hash", args.content_hash))
      .collect();
    if (args.role) {
      return assets.find((asset) => asset.role === args.role) ?? null;
    }
    return assets[0] ?? null;
  },
});

export const getAsset = zInternalQuery({
  args: z.object({
    asset_id: zid("evidence_assets"),
  }),
  handler: async (ctx, args) => {
    return ctx.db.get(args.asset_id);
  },
});

export const listUniverseCandidates = zInternalQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_candidates")
      .withIndex("by_universe_provider_external", (q) => q.eq("universe_id", args.universe_id))
      .collect();
  },
});

export const listRunCandidates = zInternalQuery({
  args: z.object({
    acquisition_run_id: zid("acquisition_runs"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_candidates")
      .withIndex("by_run", (q) => q.eq("acquisition_run_id", args.acquisition_run_id))
      .collect();
  },
});

export const listUniverseItems = zInternalQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_items")
      .withIndex("by_universe", (q) => q.eq("universe_id", args.universe_id))
      .collect();
  },
});

export const listUniverseEvidenceSets = zInternalQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_sets")
      .withIndex("by_universe", (q) => q.eq("universe_id", args.universe_id))
      .collect();
  },
});

export const listEvidenceSetItems = zInternalQuery({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  handler: async (ctx, args) => {
    return ctx.db
      .query("evidence_set_items")
      .withIndex("by_set", (q) => q.eq("evidence_set_id", args.evidence_set_id))
      .collect();
  },
});
