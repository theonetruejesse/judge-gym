"use node";

import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import z from "zod";
import { zInternalAction } from "../../utils/custom_fns";

export const MediaCloudDiscoveryArgsSchema = z.object({
  query: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  collection_ids: z.array(z.number().int().positive()).default([]),
  source_ids: z.array(z.number().int().positive()).default([]),
  pagination_token: z.string().nullable().optional(),
  page_size: z.number().int().positive().optional(),
  sort_order: z.string().optional(),
});

export const MediaCloudCandidateSchema = z.object({
  external_id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  publish_date: z.string().nullable(),
  indexed_date: z.string().nullable(),
  media_name: z.string().nullable(),
  media_url: z.string().nullable(),
  language: z.string().nullable(),
  metadata_json: z.string(),
});

export const MediaCloudDiscoveryResultSchema = z.object({
  candidates: z.array(MediaCloudCandidateSchema),
  pagination_token: z.string().nullable(),
});

type MediaCloudStory = {
  id: string | number;
  url: string;
  title?: string | null;
  publish_date?: string | null;
  indexed_date?: string | null;
  media_name?: string | null;
  media_url?: string | null;
  language?: string | null;
  [key: string]: unknown;
};

type MediaCloudStoryListResponse = {
  stories?: MediaCloudStory[];
  pagination_token?: string | null;
};

function getMediaCloudApiKey(): string {
  const apiKey = process.env.MEDIACLOUD_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("MEDIACLOUD_API_KEY is required for Media Cloud discovery.");
  }
  return apiKey;
}

export function buildMediaCloudStoryListUrl(args: z.infer<typeof MediaCloudDiscoveryArgsSchema>) {
  const settings = DEFAULT_ENGINE_SETTINGS.window.mediacloud;
  const url = new URL("search/story-list", settings.baseUrl);
  url.searchParams.set("q", args.query);
  url.searchParams.set("start", args.start_date);
  url.searchParams.set("end", args.end_date);
  url.searchParams.set("platform", settings.platform);
  if (args.collection_ids.length > 0) {
    url.searchParams.set("cs", args.collection_ids.join(","));
  }
  if (args.source_ids.length > 0) {
    url.searchParams.set("ss", args.source_ids.join(","));
  }
  if (args.pagination_token) {
    url.searchParams.set("pagination_token", args.pagination_token);
  }
  url.searchParams.set(
    "page_size",
    String(
      Math.min(
        args.page_size ?? settings.defaultPageSize,
        settings.maxPageSize,
      ),
    ),
  );
  const sortOrder = args.sort_order ?? settings.defaultSortOrder;
  if (sortOrder) {
    url.searchParams.set("sort_order", sortOrder);
  }
  return url;
}

export function normalizeMediaCloudStory(story: MediaCloudStory) {
  return {
    external_id: String(story.id),
    url: story.url,
    title: story.title ?? null,
    publish_date: story.publish_date ?? null,
    indexed_date: story.indexed_date ?? null,
    media_name: story.media_name ?? null,
    media_url: story.media_url ?? null,
    language: story.language ?? null,
    metadata_json: JSON.stringify(story),
  };
}

export async function fetchMediaCloudStoryList(
  args: z.infer<typeof MediaCloudDiscoveryArgsSchema>,
  fetchImpl: typeof fetch = fetch,
): Promise<z.infer<typeof MediaCloudDiscoveryResultSchema>> {
  const settings = DEFAULT_ENGINE_SETTINGS.window.mediacloud;
  const response = await fetchImpl(buildMediaCloudStoryListUrl(args), {
    headers: {
      Authorization: `Token ${getMediaCloudApiKey()}`,
      Accept: "application/json",
      "User-Agent": "judge-gym/mediacloud-discovery",
    },
    method: "GET",
    signal: AbortSignal.timeout(settings.requestTimeoutMs),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Media Cloud story-list failed (${response.status}): ${body}`);
  }

  const result = (await response.json()) as MediaCloudStoryListResponse;
  return {
    candidates: (result.stories ?? []).map(normalizeMediaCloudStory),
    pagination_token: result.pagination_token ?? null,
  };
}

export const discoverMediaCloudCandidates = zInternalAction({
  args: MediaCloudDiscoveryArgsSchema,
  returns: MediaCloudDiscoveryResultSchema,
  handler: async (_ctx, args) => {
    return fetchMediaCloudStoryList(args);
  },
});
