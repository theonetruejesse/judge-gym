import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zAction, zMutation, zQuery } from "../utils/custom_fns";
import { internal } from "../_generated/api";
import {
  AcquisitionSpecsTableSchema,
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

const EvidenceUniverseSummarySchema = z.object({
  universe_id: zid("evidence_universes"),
  universe_tag: z.string(),
  kind: EvidenceUniverseTableSchema.shape.kind,
  title: z.string(),
  status: z.string(),
  acquisition_spec_count: z.number(),
  candidate_count: z.number(),
  item_count: z.number(),
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

    const [acquisitionSpecs, candidates, items] = await Promise.all([
      ctx.db
        .query("acquisition_specs")
        .withIndex("by_universe", (q) => q.eq("universe_id", universe._id))
        .collect(),
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
      candidate_count: candidates.length,
      item_count: items.length,
    };
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
