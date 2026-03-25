import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { zAction, zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import {
  AcquisitionSpecsTableSchema,
  EvidenceItemsTableSchema,
  EvidenceSetItemsTableSchema,
  EvidenceSetsTableSchema,
  EvidenceUniverseTableSchema,
} from "../models/evidence";

const EvidenceUniverseInputSchema = z.object({
  universe_tag: z.string(),
  kind: EvidenceUniverseTableSchema.shape.kind,
  title: z.string(),
  description: z.string().nullable().optional(),
  citation_json: z.string().nullable().optional(),
  license_json: z.string().nullable().optional(),
  default_locale: z.string().nullable().optional(),
});

const AcquisitionSpecInputSchema = z.object({
  universe_id: zid("evidence_universes"),
  spec_tag: z.string(),
  discovery_provider: AcquisitionSpecsTableSchema.shape.discovery_provider,
  discovery_config_json: z.string(),
  hydrator_kind: AcquisitionSpecsTableSchema.shape.hydrator_kind,
  hydrator_config_json: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const AcquisitionRunInputSchema = z.object({
  acquisition_spec_id: zid("acquisition_specs"),
  cursor_json: z.string().nullable().optional(),
  workflow_id: z.string().nullable().optional(),
  workflow_run_id: z.string().nullable().optional(),
});

const CreateUniverseResultSchema = z.object({
  universe_id: zid("evidence_universes"),
});

const CreateAcquisitionSpecResultSchema = z.object({
  acquisition_spec_id: zid("acquisition_specs"),
});

const CreateAcquisitionRunResultSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
});

const IngestAcquisitionRunArgsSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  pagination_token: z.string().nullable().optional(),
  page_size: z.number().int().positive().optional(),
  sort_order: z.string().optional(),
  persist_provider_payloads: z.boolean().optional(),
});

const IngestAcquisitionRunResultSchema = z.object({
  inserted: z.number(),
  updated: z.number(),
  total: z.number(),
  candidate_ids: z.array(zid("evidence_candidates")),
  pagination_token: z.string().nullable(),
});

const HydrateAcquisitionRunArgsSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  limit: z.number().int().positive().optional(),
  extraction_version: z.string().optional(),
});

const HydrateCandidateItemSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  source_text_record_id: zid("evidence_source_records"),
  source_html_record_id: zid("evidence_source_records").nullable(),
  raw_text_asset_id: zid("evidence_assets"),
  raw_html_asset_id: zid("evidence_assets").nullable(),
  action: z.enum(["created", "updated"]),
});

const HydrateAcquisitionRunResultSchema = z.object({
  processed: z.number(),
  hydrated: z.number(),
  skipped: z.number(),
  items: z.array(HydrateCandidateItemSchema),
});

const ImportEvidenceItemArgsSchema = z.object({
  universe_id: zid("evidence_universes"),
  canonical_key: z.string(),
  title: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  source_name: z.string().nullable().optional(),
  publish_date: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  raw_text: z.string().min(1),
  raw_html: z.string().nullable().optional(),
  metadata_json: z.string().nullable().optional(),
  source_record_kind: z.enum(["source_text", "paper_original"]).optional(),
  pipeline_kind: z.string().optional(),
  pipeline_version: z.string().optional(),
});

const ImportEvidenceItemResultSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  source_record_id: zid("evidence_source_records"),
  source_html_record_id: zid("evidence_source_records").nullable(),
  raw_text_asset_id: zid("evidence_assets"),
  raw_html_asset_id: zid("evidence_assets").nullable(),
  action: z.enum(["created", "updated"]),
});

const EvidenceSetInputSchema = z.object({
  universe_id: zid("evidence_universes"),
  evidence_set_tag: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  source_kind: EvidenceSetsTableSchema.shape.source_kind,
  quality_label: EvidenceSetsTableSchema.shape.quality_label.optional(),
  selection_config_json: z.string().nullable().optional(),
  status: EvidenceSetsTableSchema.shape.status.optional(),
});

const EvidenceSetItemInputSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  pinned_source_record_id: zid("evidence_source_records").nullable().optional(),
  pinned_view_id: zid("evidence_views").nullable().optional(),
  ordinal: z.number().optional(),
  inclusion_reason: z.string().nullable().optional(),
  quality_label: EvidenceSetItemsTableSchema.shape.quality_label.optional(),
  metadata_json: z.string().nullable().optional(),
});

const CreateEvidenceSetResultSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
});

const CreateEvidenceSetFromAcquisitionRunArgsSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  evidence_set_tag: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  quality_label: EvidenceSetsTableSchema.shape.quality_label.optional(),
});

const CreateEvidenceSetFromAcquisitionRunResultSchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  item_count: z.number(),
});

const UpsertEvidenceSetItemsResultSchema = z.object({
  inserted: z.number(),
  updated: z.number(),
  total: z.number(),
});

const EvidenceUniverseSummarySchema = z.object({
  universe_id: zid("evidence_universes"),
  universe_tag: z.string(),
  kind: EvidenceUniverseTableSchema.shape.kind,
  title: z.string(),
  status: z.string(),
  acquisition_spec_count: z.number(),
  evidence_set_count: z.number(),
  candidate_count: z.number(),
  item_count: z.number(),
});

const EvidenceUniverseCatalogEntrySchema = EvidenceUniverseSummarySchema.extend({
  latest_acquisition_run_id: zid("acquisition_runs").nullable(),
  latest_acquisition_spec_id: zid("acquisition_specs").nullable(),
  latest_spec_tag: z.string().nullable(),
  latest_run_status: z.string().nullable(),
  acquisition_run_count: z.number(),
});

const EvidenceSetSummarySchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  universe_id: zid("evidence_universes"),
  evidence_set_tag: z.string(),
  title: z.string(),
  source_kind: EvidenceSetsTableSchema.shape.source_kind,
  quality_label: EvidenceSetsTableSchema.shape.quality_label,
  item_count: z.number(),
  status: z.string(),
});

const EvidenceSetCatalogEntrySchema = z.object({
  evidence_set_id: zid("evidence_sets"),
  universe_id: zid("evidence_universes"),
  universe_tag: z.string(),
  universe_title: z.string(),
  evidence_set_tag: z.string(),
  title: z.string(),
  source_kind: EvidenceSetsTableSchema.shape.source_kind,
  quality_label: EvidenceSetsTableSchema.shape.quality_label,
  item_count: z.number(),
  status: z.string(),
});

const EvidenceSetItemSummarySchema = z.object({
  evidence_set_item_id: zid("evidence_set_items"),
  evidence_item_id: zid("evidence_items"),
  pinned_source_record_id: zid("evidence_source_records").nullable(),
  pinned_view_id: zid("evidence_views").nullable(),
  ordinal: z.number(),
  inclusion_reason: z.string().nullable(),
  quality_label: EvidenceSetItemsTableSchema.shape.quality_label,
  title: EvidenceItemsTableSchema.shape.title.nullable(),
  source_url: EvidenceItemsTableSchema.shape.source_url.nullable(),
  source_name: EvidenceItemsTableSchema.shape.source_name.nullable(),
  publish_date: EvidenceItemsTableSchema.shape.publish_date.nullable(),
  language: EvidenceItemsTableSchema.shape.language.nullable(),
  canonical_key: EvidenceItemsTableSchema.shape.canonical_key,
});

const AcquisitionRunSummarySchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  acquisition_spec_id: zid("acquisition_specs"),
  universe_id: zid("evidence_universes"),
  spec_tag: z.string(),
  discovery_provider: AcquisitionSpecsTableSchema.shape.discovery_provider,
  hydrator_kind: AcquisitionSpecsTableSchema.shape.hydrator_kind,
  status: z.string(),
  cursor_json: z.string().nullable(),
  discovered_count: z.number(),
  hydrated_count: z.number(),
  error_count: z.number(),
  last_error_message: z.string().nullable(),
  candidate_count: z.number(),
  item_count: z.number(),
});

const AcquisitionRunCatalogEntrySchema = AcquisitionRunSummarySchema.extend({
  started_at_ms: z.number().nullable(),
  finished_at_ms: z.number().nullable(),
});

const EvidenceUniverseItemSummarySchema = z.object({
  evidence_item_id: zid("evidence_items"),
  universe_id: zid("evidence_universes"),
  canonical_key: z.string(),
  title: EvidenceItemsTableSchema.shape.title.nullable(),
  source_url: EvidenceItemsTableSchema.shape.source_url.nullable(),
  source_name: EvidenceItemsTableSchema.shape.source_name.nullable(),
  publish_date: EvidenceItemsTableSchema.shape.publish_date.nullable(),
  language: EvidenceItemsTableSchema.shape.language.nullable(),
  hydration_status: EvidenceItemsTableSchema.shape.hydration_status,
  created_at_ms: z.number(),
});

const EvidenceItemContentSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  canonical_key: z.string(),
  title: EvidenceItemsTableSchema.shape.title.nullable(),
  source_url: EvidenceItemsTableSchema.shape.source_url.nullable(),
  source_name: EvidenceItemsTableSchema.shape.source_name.nullable(),
  publish_date: EvidenceItemsTableSchema.shape.publish_date.nullable(),
  source_records: z.array(z.object({
    evidence_source_record_id: zid("evidence_source_records"),
    record_kind: z.string(),
    is_primary: z.boolean(),
    pipeline_kind: z.string(),
    pipeline_version: z.string(),
    content: z.string().nullable(),
  })),
  views: z.array(z.object({
    evidence_view_id: zid("evidence_views"),
    view_kind: z.string(),
    pipeline_kind: z.string(),
    pipeline_version: z.string(),
    content: z.string().nullable(),
  })),
});

async function readStorageText(ctx: ActionCtx, storageId: string) {
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error(`Storage asset URL not available for ${storageId}`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch storage asset ${storageId}: ${response.status}`);
  }
  return response.text();
}

export const createEvidenceUniverse: ReturnType<typeof zMutation> = zMutation({
  args: EvidenceUniverseInputSchema,
  returns: CreateUniverseResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof CreateUniverseResultSchema>> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.createUniverse, args);
  },
});

export const createAcquisitionSpec: ReturnType<typeof zMutation> = zMutation({
  args: AcquisitionSpecInputSchema,
  returns: CreateAcquisitionSpecResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof CreateAcquisitionSpecResultSchema>> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.createAcquisitionSpec, args);
  },
});

export const createAcquisitionRun: ReturnType<typeof zMutation> = zMutation({
  args: AcquisitionRunInputSchema,
  returns: CreateAcquisitionRunResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof CreateAcquisitionRunResultSchema>> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.createAcquisitionRun, args);
  },
});

export const ingestAcquisitionRun: ReturnType<typeof zAction> = zAction({
  args: IngestAcquisitionRunArgsSchema,
  returns: IngestAcquisitionRunResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof IngestAcquisitionRunResultSchema>> => {
    const acquisitionRun = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionRun,
      {
        acquisition_run_id: args.acquisition_run_id,
      },
    );
    if (!acquisitionRun) {
      throw new Error("Acquisition run not found.");
    }
    const acquisitionSpec = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionSpec,
      {
        acquisition_spec_id: acquisitionRun.acquisition_spec_id,
      },
    );
    if (!acquisitionSpec) {
      throw new Error("Acquisition spec not found.");
    }

    switch (acquisitionSpec.discovery_provider) {
      case "mediacloud":
        return ctx.runAction(
          internal.domain.evidence.evidence_service.ingestMediaCloudDiscoveryRun,
          args,
        );
      default:
        throw new Error(
          `Unsupported discovery provider for ingestAcquisitionRun: ${acquisitionSpec.discovery_provider}`,
        );
    }
  },
});

export const hydrateAcquisitionRun: ReturnType<typeof zAction> = zAction({
  args: HydrateAcquisitionRunArgsSchema,
  returns: HydrateAcquisitionRunResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof HydrateAcquisitionRunResultSchema>> => {
    return ctx.runAction(internal.domain.evidence.evidence_service.hydrateRunCandidates, args);
  },
});

export const importEvidenceItem: ReturnType<typeof zAction> = zAction({
  args: ImportEvidenceItemArgsSchema,
  returns: ImportEvidenceItemResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof ImportEvidenceItemResultSchema>> => {
    return ctx.runAction(internal.domain.evidence.evidence_service.importEvidenceItem, args);
  },
});

export const createEvidenceSet: ReturnType<typeof zMutation> = zMutation({
  args: EvidenceSetInputSchema,
  returns: CreateEvidenceSetResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof CreateEvidenceSetResultSchema>> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.createEvidenceSet, args);
  },
});

export const createEvidenceSetFromAcquisitionRun: ReturnType<typeof zMutation> = zMutation({
  args: CreateEvidenceSetFromAcquisitionRunArgsSchema,
  returns: CreateEvidenceSetFromAcquisitionRunResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof CreateEvidenceSetFromAcquisitionRunResultSchema>> => {
    const acquisitionRun = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionRun,
      { acquisition_run_id: args.acquisition_run_id },
    );
    if (!acquisitionRun) {
      throw new Error("Acquisition run not found.");
    }
    const acquisitionSpec = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionSpec,
      { acquisition_spec_id: acquisitionRun.acquisition_spec_id },
    );
    if (!acquisitionSpec) {
      throw new Error("Acquisition spec not found.");
    }
    const runCandidates = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.listRunCandidates,
      { acquisition_run_id: acquisitionRun._id },
    );
    const hydratedItems = await Promise.all(
      runCandidates.map(async (candidate: (typeof runCandidates)[number]) => {
        const item = await ctx.runQuery(
          internal.domain.evidence.evidence_repo.getItemByCandidate,
          { candidate_id: candidate._id },
        );
        if (!item || item.hydration_status !== "hydrated") {
          return null;
        }
        return item;
      }),
    );
    const orderedItems = hydratedItems
      .filter((item): item is NonNullable<(typeof hydratedItems)[number]> => item != null)
      .sort((left: NonNullable<(typeof hydratedItems)[number]>, right: NonNullable<(typeof hydratedItems)[number]>) => {
        const leftDate = left.publish_date ?? "";
        const rightDate = right.publish_date ?? "";
        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }
        return (left.title ?? left.canonical_key).localeCompare(
          right.title ?? right.canonical_key,
        );
      });
    if (orderedItems.length === 0) {
      throw new Error("Acquisition run has no hydrated evidence items.");
    }

    const selectionConfig = JSON.stringify({
      acquisition_run_id: acquisitionRun._id,
      acquisition_spec_id: acquisitionSpec._id,
      discovery_provider: acquisitionSpec.discovery_provider,
    });
    const { evidence_set_id } = await ctx.runMutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id: acquisitionSpec.universe_id,
        evidence_set_tag: args.evidence_set_tag,
        title: args.title,
        description: args.description ?? null,
        source_kind: "universe_slice",
        quality_label: args.quality_label ?? "high",
        selection_config_json: selectionConfig,
      },
    );

    await ctx.runMutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, {
      evidence_set_id,
      items: orderedItems.map((item: (typeof orderedItems)[number], index: number) => ({
        evidence_item_id: item._id,
        ordinal: index,
        quality_label: args.quality_label ?? "high",
      })),
    });

    return {
      evidence_set_id,
      item_count: orderedItems.length,
    };
  },
});

export const addEvidenceSetItems: ReturnType<typeof zMutation> = zMutation({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
    items: z.array(EvidenceSetItemInputSchema),
  }),
  returns: UpsertEvidenceSetItemsResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof UpsertEvidenceSetItemsResultSchema>> => {
    return ctx.runMutation(internal.domain.evidence.evidence_repo.upsertEvidenceSetItems, args);
  },
});

export const getEvidenceUniverseSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  returns: EvidenceUniverseSummarySchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceUniverseSummarySchema>> => {
    const universe = await ctx.runQuery(internal.domain.evidence.evidence_repo.getUniverse, args);
    if (!universe) {
      throw new Error("Evidence universe not found.");
    }

    const [acquisitionSpecs, evidenceSets, candidates, items] = await Promise.all([
      ctx.db
        .query("acquisition_specs")
        .withIndex("by_universe", (q) => q.eq("universe_id", universe._id))
        .collect(),
      ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseEvidenceSets, {
        universe_id: universe._id,
      }),
      ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseCandidates, {
        universe_id: universe._id,
      }),
      ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseItems, {
        universe_id: universe._id,
      }),
    ]);

    return {
      universe_id: universe._id,
      universe_tag: universe.universe_tag,
      kind: universe.kind,
      title: universe.title,
      status: universe.status,
      acquisition_spec_count: acquisitionSpecs.length,
      evidence_set_count: evidenceSets.length,
      candidate_count: candidates.length,
      item_count: items.length,
    };
  },
});

export const listEvidenceUniverses: ReturnType<typeof zQuery> = zQuery({
  args: z.object({}),
  returns: z.array(EvidenceUniverseCatalogEntrySchema),
  handler: async (ctx): Promise<Array<z.infer<typeof EvidenceUniverseCatalogEntrySchema>>> => {
    const universes = await ctx.db.query("evidence_universes").collect();
    const rows = await Promise.all(
      universes.map(async (universe: (typeof universes)[number]) => {
        const [acquisitionSpecs, acquisitionRuns, evidenceSets, candidates, items] = await Promise.all([
          ctx.db
            .query("acquisition_specs")
            .withIndex("by_universe", (q) => q.eq("universe_id", universe._id))
            .collect(),
          ctx.db.query("acquisition_runs").collect(),
          ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseEvidenceSets, {
            universe_id: universe._id,
          }),
          ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseCandidates, {
            universe_id: universe._id,
          }),
          ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseItems, {
            universe_id: universe._id,
          }),
        ]);
        const specIds = new Set(acquisitionSpecs.map((spec: (typeof acquisitionSpecs)[number]) => String(spec._id)));
        const latestRun = acquisitionRuns
          .filter((run: (typeof acquisitionRuns)[number]) => specIds.has(String(run.acquisition_spec_id)))
          .sort((left: (typeof acquisitionRuns)[number], right: (typeof acquisitionRuns)[number]) => right._creationTime - left._creationTime)[0] ?? null;
        const latestSpec = latestRun
          ? acquisitionSpecs.find((spec: (typeof acquisitionSpecs)[number]) => spec._id === latestRun.acquisition_spec_id) ?? null
          : null;
        return {
          universe_id: universe._id,
          universe_tag: universe.universe_tag,
          kind: universe.kind,
          title: universe.title,
          status: universe.status,
          acquisition_spec_count: acquisitionSpecs.length,
          acquisition_run_count: latestRun
            ? acquisitionRuns.filter((run: (typeof acquisitionRuns)[number]) => specIds.has(String(run.acquisition_spec_id))).length
            : 0,
          evidence_set_count: evidenceSets.length,
          candidate_count: candidates.length,
          item_count: items.length,
          latest_acquisition_run_id: latestRun?._id ?? null,
          latest_acquisition_spec_id: latestSpec?._id ?? null,
          latest_spec_tag: latestSpec?.spec_tag ?? null,
          latest_run_status: latestRun?.status ?? null,
        };
      }),
    );
    return rows.sort((left, right) => left.universe_tag.localeCompare(right.universe_tag));
  },
});

export const getAcquisitionRunSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    acquisition_run_id: zid("acquisition_runs"),
  }),
  returns: AcquisitionRunSummarySchema,
  handler: async (ctx, args): Promise<z.infer<typeof AcquisitionRunSummarySchema>> => {
    const acquisitionRun = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionRun,
      args,
    );
    if (!acquisitionRun) {
      throw new Error("Acquisition run not found.");
    }
    const acquisitionSpec = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.getAcquisitionSpec,
      {
        acquisition_spec_id: acquisitionRun.acquisition_spec_id,
      },
    );
    if (!acquisitionSpec) {
      throw new Error("Acquisition spec not found.");
    }

    const [candidateRows, itemRows] = await Promise.all([
      ctx.runQuery(internal.domain.evidence.evidence_repo.listRunCandidates, {
        acquisition_run_id: acquisitionRun._id,
      }),
      ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseItems, {
        universe_id: acquisitionSpec.universe_id,
      }),
    ]);

    return {
      acquisition_run_id: acquisitionRun._id,
      acquisition_spec_id: acquisitionSpec._id,
      universe_id: acquisitionSpec.universe_id,
      spec_tag: acquisitionSpec.spec_tag,
      discovery_provider: acquisitionSpec.discovery_provider,
      hydrator_kind: acquisitionSpec.hydrator_kind,
      status: acquisitionRun.status,
      cursor_json: acquisitionRun.cursor_json ?? null,
      discovered_count: acquisitionRun.discovered_count,
      hydrated_count: acquisitionRun.hydrated_count,
      error_count: acquisitionRun.error_count,
      last_error_message: acquisitionRun.last_error_message ?? null,
      candidate_count: candidateRows.length,
      item_count: itemRows.length,
    };
  },
});

export const listAcquisitionRuns: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    universe_id: zid("evidence_universes").optional(),
  }),
  returns: z.array(AcquisitionRunCatalogEntrySchema),
  handler: async (ctx, args): Promise<Array<z.infer<typeof AcquisitionRunCatalogEntrySchema>>> => {
    const acquisitionRuns = await ctx.db.query("acquisition_runs").collect();
    const rows = await Promise.all(
      acquisitionRuns.map(async (run) => {
        const spec = await ctx.runQuery(
          internal.domain.evidence.evidence_repo.getAcquisitionSpec,
          { acquisition_spec_id: run.acquisition_spec_id },
        );
        if (!spec) {
          throw new Error(`Acquisition spec missing for run ${run._id}`);
        }
        if (args.universe_id && spec.universe_id !== args.universe_id) {
          return null;
        }
        const [candidateRows, itemRows] = await Promise.all([
          ctx.runQuery(internal.domain.evidence.evidence_repo.listRunCandidates, {
            acquisition_run_id: run._id,
          }),
          ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseItems, {
            universe_id: spec.universe_id,
          }),
        ]);
        return {
          acquisition_run_id: run._id,
          acquisition_spec_id: spec._id,
          universe_id: spec.universe_id,
          spec_tag: spec.spec_tag,
          discovery_provider: spec.discovery_provider,
          hydrator_kind: spec.hydrator_kind,
          status: run.status,
          cursor_json: run.cursor_json ?? null,
          discovered_count: run.discovered_count,
          hydrated_count: run.hydrated_count,
          error_count: run.error_count,
          last_error_message: run.last_error_message ?? null,
          candidate_count: candidateRows.length,
          item_count: itemRows.length,
          started_at_ms: run.started_at_ms ?? null,
          finished_at_ms: run.finished_at_ms ?? null,
        };
      }),
    );
    return rows
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort((left, right) => (right.started_at_ms ?? 0) - (left.started_at_ms ?? 0));
  },
});

export const getEvidenceSetSummary: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  returns: EvidenceSetSummarySchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceSetSummarySchema>> => {
    const evidenceSet = await ctx.runQuery(internal.domain.evidence.evidence_repo.getEvidenceSet, {
      evidence_set_id: args.evidence_set_id,
    });
    if (!evidenceSet) {
      throw new Error("Evidence set not found.");
    }

    return {
      evidence_set_id: evidenceSet._id,
      universe_id: evidenceSet.universe_id,
      evidence_set_tag: evidenceSet.evidence_set_tag,
      title: evidenceSet.title,
      source_kind: evidenceSet.source_kind,
      quality_label: evidenceSet.quality_label,
      item_count: evidenceSet.item_count,
      status: evidenceSet.status,
    };
  },
});

export const listUniverseItems: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    universe_id: zid("evidence_universes"),
  }),
  returns: z.array(EvidenceUniverseItemSummarySchema),
  handler: async (ctx, args): Promise<Array<z.infer<typeof EvidenceUniverseItemSummarySchema>>> => {
    const items = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.listUniverseItems,
      { universe_id: args.universe_id },
    );
    return items
      .map((item: (typeof items)[number]) => ({
        evidence_item_id: item._id,
        universe_id: item.universe_id,
        canonical_key: item.canonical_key,
        title: item.title ?? null,
        source_url: item.source_url ?? null,
        source_name: item.source_name ?? null,
        publish_date: item.publish_date ?? null,
        language: item.language ?? null,
        hydration_status: item.hydration_status,
        created_at_ms: item.created_at_ms,
      }))
      .sort((left: z.infer<typeof EvidenceUniverseItemSummarySchema>, right: z.infer<typeof EvidenceUniverseItemSummarySchema>) => {
        const leftDate = left.publish_date ?? "";
        const rightDate = right.publish_date ?? "";
        if (leftDate !== rightDate) {
          return rightDate.localeCompare(leftDate);
        }
        return (left.title ?? left.canonical_key).localeCompare(
          right.title ?? right.canonical_key,
        );
      });
  },
});

export const listEvidenceSets: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    universe_id: zid("evidence_universes").optional(),
  }),
  returns: z.array(EvidenceSetCatalogEntrySchema),
  handler: async (ctx, args): Promise<Array<z.infer<typeof EvidenceSetCatalogEntrySchema>>> => {
    const evidenceSets = args.universe_id
      ? await ctx.runQuery(internal.domain.evidence.evidence_repo.listUniverseEvidenceSets, {
        universe_id: args.universe_id,
      })
      : await ctx.db.query("evidence_sets").collect();

    const rows = await Promise.all(
      evidenceSets.map(async (evidenceSet: (typeof evidenceSets)[number]) => {
        const universe = await ctx.runQuery(internal.domain.evidence.evidence_repo.getUniverse, {
          universe_id: evidenceSet.universe_id,
        });
        if (!universe) {
          throw new Error(`Evidence universe missing for set ${evidenceSet._id}`);
        }
        return {
          evidence_set_id: evidenceSet._id,
          universe_id: universe._id,
          universe_tag: universe.universe_tag,
          universe_title: universe.title,
          evidence_set_tag: evidenceSet.evidence_set_tag,
          title: evidenceSet.title,
          source_kind: evidenceSet.source_kind,
          quality_label: evidenceSet.quality_label,
          item_count: evidenceSet.item_count,
          status: evidenceSet.status,
        };
      }),
    );

    return rows.sort((left, right) => {
      if (left.universe_tag !== right.universe_tag) {
        return left.universe_tag.localeCompare(right.universe_tag);
      }
      return left.evidence_set_tag.localeCompare(right.evidence_set_tag);
    });
  },
});

export const getEvidenceItemContent: ReturnType<typeof zAction> = zAction({
  args: z.object({
    evidence_item_id: zid("evidence_items"),
  }),
  returns: EvidenceItemContentSchema,
  handler: async (ctx, args): Promise<z.infer<typeof EvidenceItemContentSchema>> => {
    const item = await ctx.runQuery(internal.domain.evidence.evidence_repo.getItem, {
      evidence_item_id: args.evidence_item_id,
    });
    if (!item) {
      throw new Error("Evidence item not found.");
    }
    const [sourceRecords, views] = await Promise.all([
      ctx.runQuery(internal.domain.evidence.evidence_repo.listItemSourceRecords, {
        evidence_item_id: item._id,
      }),
      ctx.runQuery(internal.domain.evidence.evidence_repo.listItemViews, {
        evidence_item_id: item._id,
      }),
    ]);

    const [renderedSourceRecords, renderedViews] = await Promise.all([
      Promise.all(
        sourceRecords.map(async (record: (typeof sourceRecords)[number]) => {
          const asset = await ctx.runQuery(internal.domain.evidence.evidence_repo.getAsset, {
            asset_id: record.asset_id,
          });
          return {
            evidence_source_record_id: record._id,
            record_kind: record.record_kind,
            is_primary: record.is_primary,
            pipeline_kind: record.pipeline_kind,
            pipeline_version: record.pipeline_version,
            content: asset ? await readStorageText(ctx, asset.storage_id) : null,
          };
        }),
      ),
      Promise.all(
        views.map(async (view: (typeof views)[number]) => {
          const asset = view.asset_id
            ? await ctx.runQuery(internal.domain.evidence.evidence_repo.getAsset, {
              asset_id: view.asset_id,
            })
            : null;
          return {
            evidence_view_id: view._id,
            view_kind: view.view_kind,
            pipeline_kind: view.pipeline_kind,
            pipeline_version: view.pipeline_version,
            content: asset ? await readStorageText(ctx, asset.storage_id) : null,
          };
        }),
      ),
    ]);

    return {
      evidence_item_id: item._id,
      canonical_key: item.canonical_key,
      title: item.title ?? null,
      source_url: item.source_url ?? null,
      source_name: item.source_name ?? null,
      publish_date: item.publish_date ?? null,
      source_records: renderedSourceRecords.sort((
        left: (typeof renderedSourceRecords)[number],
        right: (typeof renderedSourceRecords)[number],
      ) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1;
        }
        if (left.record_kind !== right.record_kind) {
          return left.record_kind.localeCompare(right.record_kind);
        }
        return left.pipeline_version.localeCompare(right.pipeline_version);
      }),
      views: renderedViews.sort((
        left: (typeof renderedViews)[number],
        right: (typeof renderedViews)[number],
      ) => left.view_kind.localeCompare(right.view_kind)),
    };
  },
});

export const listEvidenceSetItems: ReturnType<typeof zQuery> = zQuery({
  args: z.object({
    evidence_set_id: zid("evidence_sets"),
  }),
  returns: z.array(EvidenceSetItemSummarySchema),
  handler: async (ctx, args): Promise<Array<z.infer<typeof EvidenceSetItemSummarySchema>>> => {
    const evidenceSetItems = await ctx.runQuery(
      internal.domain.evidence.evidence_repo.listEvidenceSetItems,
      {
        evidence_set_id: args.evidence_set_id,
      },
    );

    const rows = await Promise.all(
      evidenceSetItems.map(async (row: (typeof evidenceSetItems)[number]) => {
        const item = await ctx.runQuery(internal.domain.evidence.evidence_repo.getItem, {
          evidence_item_id: row.evidence_item_id,
        }) as Doc<"evidence_items"> | null;
        if (!item) {
          throw new Error(`Evidence item missing for set membership ${row._id}`);
        }
        return {
          evidence_set_item_id: row._id,
          evidence_item_id: row.evidence_item_id,
          pinned_source_record_id: row.pinned_source_record_id ?? null,
          pinned_view_id: row.pinned_view_id ?? null,
          ordinal: row.ordinal,
          inclusion_reason: row.inclusion_reason ?? null,
          quality_label: row.quality_label,
          title: item.title ?? null,
          source_url: item.source_url ?? null,
          source_name: item.source_name ?? null,
          publish_date: item.publish_date ?? null,
          language: item.language ?? null,
          canonical_key: item.canonical_key,
        };
      }),
    );

    return rows.sort((
      a: z.infer<typeof EvidenceSetItemSummarySchema>,
      b: z.infer<typeof EvidenceSetItemSummarySchema>,
    ) => a.ordinal - b.ordinal);
  },
});
