"use node";

import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import { zid } from "convex-helpers/server/zod4";
import z from "zod";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { EvidenceAssetRoleSchema } from "../../models/evidence";
import { zInternalAction } from "../../utils/custom_fns";
import {
  fetchMediaCloudStoryList,
  MediaCloudDiscoveryArgsSchema,
} from "./mediacloud";

const StoreTextAssetArgsSchema = z.object({
  content: z.string(),
  role: EvidenceAssetRoleSchema,
  mime_type: z.string(),
  encoding: z.string().nullable().optional(),
  compression: z.string().nullable().optional(),
});

const StoreTextAssetResultSchema = z.object({
  asset_id: zid("evidence_assets"),
  storage_id: z.string(),
  content_hash: z.string(),
  byte_size: z.number(),
  deduped: z.boolean(),
});

const IngestMediaCloudDiscoveryRunArgsSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  pagination_token: z.string().nullable().optional(),
  page_size: z.number().int().positive().optional(),
  sort_order: z.string().optional(),
  persist_provider_payloads: z.boolean().optional(),
});

const IngestMediaCloudDiscoveryRunResultSchema = z.object({
  inserted: z.number(),
  updated: z.number(),
  total: z.number(),
  candidate_ids: z.array(zid("evidence_candidates")),
  pagination_token: z.string().nullable(),
});

const HydrateCandidateArgsSchema = z.object({
  candidate_id: zid("evidence_candidates"),
  extraction_version: z.string().optional(),
});

const HydrateCandidateResultSchema = z.object({
  evidence_item_id: zid("evidence_items"),
  source_text_record_id: zid("evidence_source_records"),
  source_html_record_id: zid("evidence_source_records").nullable(),
  raw_text_asset_id: zid("evidence_assets"),
  raw_html_asset_id: zid("evidence_assets").nullable(),
  action: z.enum(["created", "updated"]),
});

const HydrateRunCandidatesArgsSchema = z.object({
  acquisition_run_id: zid("acquisition_runs"),
  limit: z.number().int().positive().optional(),
  extraction_version: z.string().optional(),
});

const HydrateRunCandidatesResultSchema = z.object({
  processed: z.number(),
  hydrated: z.number(),
  skipped: z.number(),
  items: z.array(HydrateCandidateResultSchema),
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

function hex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return hex(new Uint8Array(digest));
}

function normalizeWhitespace(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(content: string): string {
  return content
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");
}

export function extractTextFromHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const blockSeparated = withoutScripts
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|td|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const noTags = blockSeparated.replace(/<[^>]+>/g, " ");
  return normalizeWhitespace(decodeHtmlEntities(noTags));
}

function approximateTokenCount(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true;
  }
  return contentType.includes("text/html") || contentType.includes("application/xhtml+xml");
}

function buildCanonicalKey(candidate: {
  discovery_provider: string;
  external_id: string;
  url: string;
}): string {
  if (candidate.external_id.trim().length > 0) {
    return `${candidate.discovery_provider}:${candidate.external_id}`;
  }
  return `${candidate.discovery_provider}:url:${candidate.url}`;
}

async function storeTextAssetInternal(
  ctx: ActionCtx,
  args: z.infer<typeof StoreTextAssetArgsSchema>,
): Promise<z.infer<typeof StoreTextAssetResultSchema>> {
  const content_hash = await sha256Hex(args.content);
  const existing = await ctx.runQuery(
    internal.domain.evidence.evidence_repo.getAssetByContentHash,
    {
      content_hash,
      role: args.role,
    },
  );
  if (existing) {
    return {
      asset_id: existing._id,
      storage_id: existing.storage_id,
      content_hash,
      byte_size: existing.byte_size,
      deduped: true,
    };
  }

  const blob = new Blob([args.content], {
    type: args.mime_type,
  });
  const storage_id = await ctx.storage.store(blob);
  const { asset_id } = await ctx.runMutation(
    internal.domain.evidence.evidence_repo.createAsset,
    {
      storage_id,
      role: args.role,
      mime_type: args.mime_type,
      encoding: args.encoding ?? null,
      compression: args.compression ?? null,
      byte_size: blob.size,
      content_hash,
    },
  );
  return {
    asset_id,
    storage_id,
    content_hash,
    byte_size: blob.size,
    deduped: false,
  };
}

function parseMediaCloudDiscoveryConfig(
  discovery_config_json: string,
  overrides: Pick<
    z.infer<typeof IngestMediaCloudDiscoveryRunArgsSchema>,
    "pagination_token" | "page_size" | "sort_order"
  >,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(discovery_config_json);
  } catch (error) {
    throw new Error(
      `Invalid Media Cloud discovery_config_json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Media Cloud discovery_config_json must decode to an object.");
  }
  const parsedRecord = parsed as Record<string, unknown>;

  return MediaCloudDiscoveryArgsSchema.parse({
    ...parsedRecord,
    pagination_token: overrides.pagination_token ?? undefined,
    page_size: overrides.page_size ?? undefined,
    sort_order: overrides.sort_order ?? undefined,
  });
}

async function patchAcquisitionRunFailure(
  ctx: ActionCtx,
  args: {
    acquisition_run_id: Id<"acquisition_runs">;
    error_count: number;
    message: string;
  },
) {
  await ctx.runMutation(internal.domain.evidence.evidence_repo.patchAcquisitionRun, {
    acquisition_run_id: args.acquisition_run_id,
    status: "error",
    error_count: args.error_count,
    last_error_message: args.message,
    finished_at_ms: Date.now(),
  });
}

async function hydrateCandidateInternal(
  ctx: ActionCtx,
  args: z.infer<typeof HydrateCandidateArgsSchema>,
): Promise<z.infer<typeof HydrateCandidateResultSchema>> {
  const candidate = await ctx.runQuery(internal.domain.evidence.evidence_repo.getCandidate, {
    candidate_id: args.candidate_id,
  });
  if (!candidate) {
    throw new Error("Evidence candidate not found.");
  }

  const response = await fetch(candidate.url, {
    headers: {
      Accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.5",
      "User-Agent": "judge-gym/evidence-hydrator",
    },
    method: "GET",
    redirect: "follow",
    signal: AbortSignal.timeout(DEFAULT_ENGINE_SETTINGS.evidence.mediacloud.requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Hydration failed for ${candidate.url} (${response.status}).`);
  }

  const contentType = response.headers.get("content-type");
  const body = await response.text();
  const extraction_version = args.extraction_version ?? "simple-html-text-v1";

  let raw_html_asset_id: Id<"evidence_assets"> | null = null;
  if (isHtmlContentType(contentType)) {
    const rawHtmlAsset = await storeTextAssetInternal(ctx, {
      content: body,
      role: "raw_html",
      mime_type: contentType ?? "text/html",
      encoding: "utf-8",
    });
    raw_html_asset_id = rawHtmlAsset.asset_id;
  }

  const rawText = isHtmlContentType(contentType)
    ? extractTextFromHtml(body)
    : normalizeWhitespace(body);
  if (rawText.length === 0) {
    throw new Error(`Hydration produced empty text for ${candidate.url}.`);
  }

  const rawTextAsset = await storeTextAssetInternal(ctx, {
    content: rawText,
    role: "raw_text",
    mime_type: "text/plain",
    encoding: "utf-8",
  });

  const itemResult = await ctx.runMutation(
    internal.domain.evidence.evidence_repo.upsertItemFromCandidate,
    {
      universe_id: candidate.universe_id,
      candidate_id: candidate._id,
      canonical_key: buildCanonicalKey(candidate),
      title: candidate.title ?? null,
      source_url: candidate.url,
      source_name: candidate.media_name ?? null,
      publish_date: candidate.publish_date ?? null,
      language: candidate.language ?? null,
      hydration_status: "hydrated",
      metadata_json: JSON.stringify({
        fetched_at_ms: Date.now(),
        response_content_type: contentType,
        status: response.status,
      }),
    },
  );

  const sourceTextRecord = await ctx.runMutation(
    internal.domain.evidence.evidence_repo.upsertSourceRecord,
    {
      evidence_item_id: itemResult.evidence_item_id,
      record_kind: "source_text",
      asset_id: rawTextAsset.asset_id,
      is_primary: true,
      content_hash: rawTextAsset.content_hash,
      char_count: rawText.length,
      token_estimate: approximateTokenCount(rawText),
      pipeline_kind: "hydrate",
      pipeline_version: extraction_version,
      metadata_json: JSON.stringify({
        source: "url_hydration",
        candidate_id: String(candidate._id),
        content_hash: rawTextAsset.content_hash,
      }),
    },
  );

  let sourceHtmlRecordId: Id<"evidence_source_records"> | null = null;
  if (raw_html_asset_id) {
    const sourceHtmlRecord = await ctx.runMutation(
      internal.domain.evidence.evidence_repo.upsertSourceRecord,
      {
        evidence_item_id: itemResult.evidence_item_id,
        record_kind: "source_html",
        asset_id: raw_html_asset_id,
        is_primary: false,
        content_hash: null,
        char_count: body.length,
        token_estimate: null,
        pipeline_kind: "hydrate",
        pipeline_version: extraction_version,
        metadata_json: JSON.stringify({
          source: "url_hydration",
          candidate_id: String(candidate._id),
          response_content_type: contentType,
        }),
      },
    );
    sourceHtmlRecordId = sourceHtmlRecord.evidence_source_record_id;
  }

  const acquisitionRun = await ctx.runQuery(
    internal.domain.evidence.evidence_repo.getAcquisitionRun,
    {
      acquisition_run_id: candidate.acquisition_run_id,
    },
  );
  if (acquisitionRun && itemResult.action === "created") {
    await ctx.runMutation(internal.domain.evidence.evidence_repo.patchAcquisitionRun, {
      acquisition_run_id: acquisitionRun._id,
      hydrated_count: acquisitionRun.hydrated_count + 1,
    });
  }

  return {
    evidence_item_id: itemResult.evidence_item_id,
    source_text_record_id: sourceTextRecord.evidence_source_record_id,
    source_html_record_id: sourceHtmlRecordId,
    raw_text_asset_id: rawTextAsset.asset_id,
    raw_html_asset_id,
    action: itemResult.action,
  };
}

export const storeTextAsset = zInternalAction({
  args: StoreTextAssetArgsSchema,
  returns: StoreTextAssetResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof StoreTextAssetResultSchema>> => {
    return storeTextAssetInternal(ctx, args);
  },
});

export const ingestMediaCloudDiscoveryRun = zInternalAction({
  args: IngestMediaCloudDiscoveryRunArgsSchema,
  returns: IngestMediaCloudDiscoveryRunResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof IngestMediaCloudDiscoveryRunResultSchema>> => {
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
    if (acquisitionSpec.discovery_provider !== "mediacloud") {
      throw new Error("ingestMediaCloudDiscoveryRun requires a Media Cloud acquisition spec.");
    }

    try {
      const discoveryArgs = parseMediaCloudDiscoveryConfig(acquisitionSpec.discovery_config_json, {
        pagination_token: args.pagination_token ?? null,
        page_size: args.page_size,
        sort_order: args.sort_order,
      });
      const discoveryResult = await fetchMediaCloudStoryList(discoveryArgs);
      const candidates = await Promise.all(
        discoveryResult.candidates.map(async (candidate) => {
          let provider_payload_asset_id: Id<"evidence_assets"> | null = null;
          if (args.persist_provider_payloads ?? true) {
            const storedPayload = await storeTextAssetInternal(ctx, {
              content: candidate.metadata_json,
              role: "provider_payload",
              mime_type: "application/json",
              encoding: "utf-8",
            });
            provider_payload_asset_id = storedPayload.asset_id;
          }

          return {
            discovery_provider: "mediacloud" as const,
            external_id: candidate.external_id,
            url: candidate.url,
            title: candidate.title,
            publish_date: candidate.publish_date,
            indexed_date: candidate.indexed_date,
            media_name: candidate.media_name,
            media_url: candidate.media_url,
            language: candidate.language,
            metadata_json: candidate.metadata_json,
            provider_payload_asset_id,
          };
        }),
      );

      const upserted = await ctx.runMutation(
        internal.domain.evidence.evidence_repo.upsertCandidates,
        {
          universe_id: acquisitionSpec.universe_id,
          acquisition_run_id: acquisitionRun._id,
          candidates,
        },
      );

      await ctx.runMutation(internal.domain.evidence.evidence_repo.patchAcquisitionRun, {
        acquisition_run_id: acquisitionRun._id,
        status: discoveryResult.pagination_token ? "running" : "completed",
        cursor_json: discoveryResult.pagination_token
          ? JSON.stringify({ pagination_token: discoveryResult.pagination_token })
          : null,
        discovered_count: acquisitionRun.discovered_count + upserted.total,
        finished_at_ms: discoveryResult.pagination_token ? undefined : Date.now(),
        last_error_message: null,
      });

      return {
        inserted: upserted.inserted,
        updated: upserted.updated,
        total: upserted.total,
        candidate_ids: upserted.candidate_ids,
        pagination_token: discoveryResult.pagination_token,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await patchAcquisitionRunFailure(ctx, {
        acquisition_run_id: acquisitionRun._id,
        error_count: acquisitionRun.error_count + 1,
        message,
      });
      throw error;
    }
  },
});

export const hydrateCandidate = zInternalAction({
  args: HydrateCandidateArgsSchema,
  returns: HydrateCandidateResultSchema,
  handler: async (ctx, args): Promise<z.infer<typeof HydrateCandidateResultSchema>> => {
    return hydrateCandidateInternal(ctx, args);
  },
});

export const hydrateRunCandidates = zInternalAction({
  args: HydrateRunCandidatesArgsSchema,
  returns: HydrateRunCandidatesResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof HydrateRunCandidatesResultSchema>> => {
    const candidates = await ctx.runQuery(internal.domain.evidence.evidence_repo.listRunCandidates, {
      acquisition_run_id: args.acquisition_run_id,
    });
    const limit = args.limit ?? candidates.length;
    const selected = candidates.slice(0, limit);
    const items: Array<z.infer<typeof HydrateCandidateResultSchema>> = [];
    let skipped = 0;

    for (const candidate of selected) {
      const existingItem = await ctx.runQuery(
        internal.domain.evidence.evidence_repo.getItemByCandidate,
        {
          candidate_id: candidate._id,
        },
      );
      if (existingItem?.hydration_status === "hydrated") {
        skipped += 1;
        continue;
      }
      const hydrated = await hydrateCandidateInternal(ctx, {
        candidate_id: candidate._id,
        extraction_version: args.extraction_version,
      });
      items.push(hydrated);
    }

    return {
      processed: selected.length,
      hydrated: items.length,
      skipped,
      items,
    };
  },
});

export const importEvidenceItem = zInternalAction({
  args: ImportEvidenceItemArgsSchema,
  returns: ImportEvidenceItemResultSchema,
  handler: async (
    ctx,
    args,
  ): Promise<z.infer<typeof ImportEvidenceItemResultSchema>> => {
    const rawText = normalizeWhitespace(args.raw_text);
    if (rawText.length === 0) {
      throw new Error("Imported raw_text must contain non-whitespace content.");
    }

    let raw_html_asset_id: Id<"evidence_assets"> | null = null;
    if ((args.raw_html ?? null) != null) {
      const rawHtmlAsset = await storeTextAssetInternal(ctx, {
        content: args.raw_html ?? "",
        role: "raw_html",
        mime_type: "text/html",
        encoding: "utf-8",
      });
      raw_html_asset_id = rawHtmlAsset.asset_id;
    }

    const rawTextAsset = await storeTextAssetInternal(ctx, {
      content: rawText,
      role: "raw_text",
      mime_type: "text/plain",
      encoding: "utf-8",
    });

    const itemResult = await ctx.runMutation(
      internal.domain.evidence.evidence_repo.upsertImportedItem,
      {
        universe_id: args.universe_id,
        canonical_key: args.canonical_key,
        title: args.title ?? null,
        source_url: args.source_url ?? null,
        source_name: args.source_name ?? null,
        publish_date: args.publish_date ?? null,
        language: args.language ?? null,
        hydration_status: "hydrated",
        metadata_json: args.metadata_json ?? null,
      },
    );

    const pipelineVersion = args.pipeline_version ?? "manual-import-v1";
    const sourceRecord = await ctx.runMutation(
      internal.domain.evidence.evidence_repo.upsertSourceRecord,
      {
        evidence_item_id: itemResult.evidence_item_id,
        record_kind: args.source_record_kind ?? "paper_original",
        asset_id: rawTextAsset.asset_id,
        is_primary: true,
        content_hash: rawTextAsset.content_hash,
        char_count: rawText.length,
        token_estimate: approximateTokenCount(rawText),
        pipeline_kind: args.pipeline_kind ?? "import",
        pipeline_version: pipelineVersion,
        metadata_json: JSON.stringify({
          source: "direct_import",
          canonical_key: args.canonical_key,
        }),
      },
    );

    let sourceHtmlRecordId: Id<"evidence_source_records"> | null = null;
    if (raw_html_asset_id) {
      const sourceHtmlRecord = await ctx.runMutation(
        internal.domain.evidence.evidence_repo.upsertSourceRecord,
        {
          evidence_item_id: itemResult.evidence_item_id,
          record_kind: "source_html",
          asset_id: raw_html_asset_id,
          is_primary: false,
          content_hash: null,
          char_count: (args.raw_html ?? "").length,
          token_estimate: null,
          pipeline_kind: args.pipeline_kind ?? "import",
          pipeline_version: pipelineVersion,
          metadata_json: JSON.stringify({
            source: "direct_import",
            canonical_key: args.canonical_key,
            content_type: "text/html",
          }),
        },
      );
      sourceHtmlRecordId = sourceHtmlRecord.evidence_source_record_id;
    }

    return {
      evidence_item_id: itemResult.evidence_item_id,
      source_record_id: sourceRecord.evidence_source_record_id,
      source_html_record_id: sourceHtmlRecordId,
      raw_text_asset_id: rawTextAsset.asset_id,
      raw_html_asset_id,
      action: itemResult.action,
    };
  },
});
