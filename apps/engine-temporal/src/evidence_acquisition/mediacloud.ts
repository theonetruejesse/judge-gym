import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";

export type MediaCloudDiscoveryArgs = {
  query: string;
  start_date: string;
  end_date: string;
  collection_ids?: number[];
  source_ids?: number[];
  pagination_token?: string | null;
  page_size?: number;
  sort_order?: string;
  max_pages?: number | null;
};

export type MediaCloudCandidate = {
  external_id: string;
  url: string;
  title: string | null;
  publish_date: string | null;
  indexed_date: string | null;
  media_name: string | null;
  media_url: string | null;
  language: string | null;
  metadata_json: string;
};

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

function requireMediaCloudApiKey() {
  const apiKey = process.env.MEDIACLOUD_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("MEDIACLOUD_API_KEY is required for Media Cloud acquisition.");
  }
  return apiKey;
}

export function buildMediaCloudStoryListUrl(args: MediaCloudDiscoveryArgs) {
  const settings = DEFAULT_ENGINE_SETTINGS.evidence.mediacloud;
  const url = new URL("search/story-list", settings.baseUrl);
  url.searchParams.set("q", args.query);
  url.searchParams.set("start", args.start_date);
  url.searchParams.set("end", args.end_date);
  url.searchParams.set("platform", settings.platform);
  if ((args.collection_ids ?? []).length > 0) {
    url.searchParams.set("cs", (args.collection_ids ?? []).join(","));
  }
  if ((args.source_ids ?? []).length > 0) {
    url.searchParams.set("ss", (args.source_ids ?? []).join(","));
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

function normalizeStory(story: MediaCloudStory): MediaCloudCandidate {
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
  args: MediaCloudDiscoveryArgs,
  fetchImpl: typeof fetch = fetch,
) {
  const settings = DEFAULT_ENGINE_SETTINGS.evidence.mediacloud;
  const url = buildMediaCloudStoryListUrl(args);

  for (let attempt = 0; attempt <= settings.maxRetries; attempt += 1) {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Token ${requireMediaCloudApiKey()}`,
        Accept: "application/json",
        "User-Agent": "judge-gym/temporal-mediacloud",
      },
      signal: AbortSignal.timeout(settings.requestTimeoutMs),
    });

    if (response.ok) {
      const result = (await response.json()) as MediaCloudStoryListResponse;
      return {
        candidates: (result.stories ?? []).map(normalizeStory),
        pagination_token: result.pagination_token ?? null,
      };
    }

    const body = await response.text();
    const shouldRetry =
      attempt < settings.maxRetries &&
      [429, 500, 502, 503, 504].includes(response.status);
    if (!shouldRetry) {
      throw new Error(`Media Cloud story-list failed (${response.status}): ${body}`);
    }

    const backoffMs = Math.min(
      settings.initialBackoffMs * 2 ** attempt,
      settings.maxBackoffMs,
    );
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
  }
  throw new Error("Unreachable Media Cloud retry state.");
}
