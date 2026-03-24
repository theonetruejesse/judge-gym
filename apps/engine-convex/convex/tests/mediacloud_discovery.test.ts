import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  buildMediaCloudStoryListUrl,
  fetchMediaCloudStoryList,
  normalizeMediaCloudStory,
} from "../domain/evidence/mediacloud";

describe("Media Cloud discovery", () => {
  beforeEach(() => {
    process.env.MEDIACLOUD_API_KEY = "test-mediacloud-key";
  });

  test("builds the official story-list query shape", () => {
    const url = buildMediaCloudStoryListUrl({
      query: "modi AND biden",
      start_date: "2026-03-01",
      end_date: "2026-03-07",
      collection_ids: [34412118],
      source_ids: [99, 101],
      pagination_token: "cursor-1",
      page_size: 250,
      sort_order: "indexed_date",
    });

    expect(url.toString()).toContain("search/story-list");
    expect(url.searchParams.get("q")).toBe("modi AND biden");
    expect(url.searchParams.get("start")).toBe("2026-03-01");
    expect(url.searchParams.get("end")).toBe("2026-03-07");
    expect(url.searchParams.get("cs")).toBe("34412118");
    expect(url.searchParams.get("ss")).toBe("99,101");
    expect(url.searchParams.get("pagination_token")).toBe("cursor-1");
    expect(url.searchParams.get("page_size")).toBe("250");
    expect(url.searchParams.get("sort_order")).toBe("indexed_date");
    expect(url.searchParams.get("platform")).toBe("onlinenews-mediacloud");
  });

  test("omits sort_order when neither args nor defaults set one", () => {
    const url = buildMediaCloudStoryListUrl({
      query: "modi AND biden",
      start_date: "2026-03-01",
      end_date: "2026-03-07",
      collection_ids: [],
      source_ids: [],
    });

    expect(url.searchParams.get("sort_order")).toBeNull();
  });

  test("normalizes a Media Cloud story into candidate shape", () => {
    const candidate = normalizeMediaCloudStory({
      id: 12345,
      url: "https://example.com/story",
      title: "Story Title",
      publish_date: "2026-03-01",
      indexed_date: "2026-03-01T12:00:00",
      media_name: "Example Outlet",
      media_url: "https://example.com",
      language: "en",
      extra_field: "kept in metadata",
    });

    expect(candidate.external_id).toBe("12345");
    expect(candidate.url).toBe("https://example.com/story");
    expect(candidate.title).toBe("Story Title");
    expect(JSON.parse(candidate.metadata_json).extra_field).toBe("kept in metadata");
  });

  test("fetches and normalizes story-list results", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          stories: [
            {
              id: 1,
              url: "https://example.com/story-1",
              title: "Story One",
              publish_date: "2026-03-02",
              indexed_date: "2026-03-02T10:00:00",
              media_name: "Outlet One",
              media_url: "https://example.com",
              language: "en",
            },
          ],
          pagination_token: "cursor-2",
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      ),
    );

    const result = await fetchMediaCloudStoryList(
      {
        query: "trump",
        start_date: "2026-03-01",
        end_date: "2026-03-05",
        collection_ids: [34412234],
        source_ids: [],
      },
      fetchMock as unknown as typeof fetch,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();
    if (!call) {
      throw new Error("Expected fetch to be called.");
    }
    const [url, init] = call as unknown as [RequestInfo | URL, RequestInit];
    expect(String(url)).toContain("search/story-list");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token test-mediacloud-key");
    expect(result.pagination_token).toBe("cursor-2");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.external_id).toBe("1");
  });
});
