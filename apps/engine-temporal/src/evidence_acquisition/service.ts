import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import {
  fetchMediaCloudStoryList,
  type MediaCloudDiscoveryArgs,
} from "./mediacloud";

type EvidenceAcquisitionDependencies = {
  convex: Pick<
    ConvexWorkerClient,
    | "getAcquisitionRunExecutionContext"
    | "markAcquisitionRunRunning"
    | "finalizeAcquisitionRun"
    | "markAcquisitionRunError"
    | "persistMediaCloudDiscoveryBatch"
    | "persistCandidateHydration"
    | "markCandidateHydrationFailure"
  >;
  fetchMediaCloudStoryList: typeof fetchMediaCloudStoryList;
  fetchImpl: typeof fetch;
};

export type EvidenceAcquisitionCycleResult = {
  acquisitionRunId: string;
  completed: boolean;
  paginationToken: string | null;
  discovered: number;
  hydrated: number;
  hydrationFailures: number;
};

type ParsedDiscoveryConfig = MediaCloudDiscoveryArgs & {
  max_pages: number | null;
  page_count: number;
};

function getDefaultDependencies(): EvidenceAcquisitionDependencies {
  return {
    convex: getConvexWorkerClient(),
    fetchMediaCloudStoryList,
    fetchImpl: fetch,
  };
}

function parseDiscoveryConfig(args: {
  discoveryConfigJson: string;
  cursorJson: string | null;
}): ParsedDiscoveryConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.discoveryConfigJson);
  } catch (error) {
    throw new Error(
      `Invalid Media Cloud discovery_config_json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Media Cloud discovery_config_json must decode to an object.");
  }

  let paginationToken: string | null = null;
  let pageCount = 0;
  if (args.cursorJson) {
    try {
      const cursor = JSON.parse(args.cursorJson) as {
        pagination_token?: string | null;
        page_count?: number | null;
      };
      paginationToken = cursor.pagination_token ?? null;
      pageCount =
        typeof cursor.page_count === "number" && Number.isFinite(cursor.page_count)
          ? Math.max(0, Math.trunc(cursor.page_count))
          : 0;
    } catch (error) {
      throw new Error(
        `Invalid acquisition cursor_json: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const record = parsed as Record<string, unknown>;
  return {
    query: String(record.query ?? ""),
    start_date: String(record.start_date ?? ""),
    end_date: String(record.end_date ?? ""),
    collection_ids: Array.isArray(record.collection_ids)
      ? record.collection_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
      : [],
    source_ids: Array.isArray(record.source_ids)
      ? record.source_ids
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
      : [],
    page_size: typeof record.page_size === "number" ? record.page_size : undefined,
    sort_order: typeof record.sort_order === "string" ? record.sort_order : undefined,
    pagination_token: paginationToken,
    max_pages:
      typeof record.max_pages === "number" && Number.isFinite(record.max_pages)
        ? Math.max(1, Math.trunc(record.max_pages))
        : null,
    page_count: pageCount,
  };
}

async function fetchCandidateContent(args: {
  url: string;
  fetchImpl: typeof fetch;
}) {
  const response = await args.fetchImpl(args.url, {
    method: "GET",
    redirect: "follow",
    headers: {
      Accept: "text/html, text/plain;q=0.9, application/xhtml+xml;q=0.8, */*;q=0.5",
      "User-Agent": "judge-gym/evidence-hydrator",
    },
    signal: AbortSignal.timeout(DEFAULT_ENGINE_SETTINGS.evidence.mediacloud.requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Hydration failed for ${args.url} (${response.status}).`);
  }

  return {
    content_type: response.headers.get("content-type"),
    body: await response.text(),
  };
}

export async function runEvidenceAcquisitionCycleActivity(
  acquisitionRunId: string,
  deps = getDefaultDependencies(),
): Promise<EvidenceAcquisitionCycleResult> {
  const context = await deps.convex.getAcquisitionRunExecutionContext(acquisitionRunId);
  await deps.convex.markAcquisitionRunRunning({
    acquisition_run_id: acquisitionRunId,
  });

  try {
    if (context.discovery_provider !== "mediacloud") {
      throw new Error(
        `Unsupported discovery provider: ${context.discovery_provider}`,
      );
    }

    const discoveryArgs = parseDiscoveryConfig({
      discoveryConfigJson: context.discovery_config_json,
      cursorJson: context.cursor_json,
    });
    const discoveryResult = await deps.fetchMediaCloudStoryList(discoveryArgs, deps.fetchImpl);
    const nextPageCount = discoveryArgs.page_count + 1;
    const persisted = await deps.convex.persistMediaCloudDiscoveryBatch({
      acquisition_run_id: acquisitionRunId,
      candidates: discoveryResult.candidates,
      pagination_token: discoveryResult.pagination_token ?? null,
      page_count: nextPageCount,
      persist_provider_payloads: true,
    });

    let hydrated = 0;
    let hydrationFailures = 0;
    if (context.hydrator_kind === "url_fetch") {
      for (let index = 0; index < discoveryResult.candidates.length; index += 1) {
        const candidate = discoveryResult.candidates[index];
        const candidateId = persisted.candidate_ids[index];
        if (!candidateId) {
          continue;
        }
        try {
          const fetched = await fetchCandidateContent({
            url: candidate.url,
            fetchImpl: deps.fetchImpl,
          });
          await deps.convex.persistCandidateHydration({
            candidate_id: candidateId,
            body: fetched.body,
            content_type: fetched.content_type,
            extraction_version: "temporal-url-fetch-v1",
          });
          hydrated += 1;
        } catch (error) {
          hydrationFailures += 1;
          const message = error instanceof Error ? error.message : String(error);
          await deps.convex.markCandidateHydrationFailure({
            candidate_id: candidateId,
            error_message: message,
          });
        }
      }
    }

    const reachedPageBudget =
      discoveryArgs.max_pages != null && nextPageCount >= discoveryArgs.max_pages;
    const completed = discoveryResult.pagination_token == null || reachedPageBudget;
    if (completed) {
      await deps.convex.finalizeAcquisitionRun({
        acquisition_run_id: acquisitionRunId,
      });
    }

    return {
      acquisitionRunId,
      completed,
      paginationToken: discoveryResult.pagination_token ?? null,
      discovered: persisted.total,
      hydrated,
      hydrationFailures,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.convex.markAcquisitionRunError({
      acquisition_run_id: acquisitionRunId,
      error_message: message,
      increment_error_count: true,
    });
    throw error;
  }
}
