import assert from "assert";
import { describe, it } from "mocha";
import {
  buildMediaCloudStoryListUrl,
  fetchMediaCloudStoryList,
} from "../evidence_acquisition/mediacloud";
import { runEvidenceAcquisitionCycleActivity } from "../evidence_acquisition/service";

describe("temporal Media Cloud acquisition", () => {
  it("builds Media Cloud story-list URLs with the expected query parameters", () => {
    const url = buildMediaCloudStoryListUrl({
      query: "democratic erosion",
      start_date: "2026-01-01",
      end_date: "2026-01-31",
      collection_ids: [34412234, 7],
      source_ids: [11],
      pagination_token: "cursor-1",
      page_size: 25,
      sort_order: "publish_date",
    });

    assert.equal(url.pathname.endsWith("/search/story-list"), true);
    assert.equal(url.searchParams.get("q"), "democratic erosion");
    assert.equal(url.searchParams.get("start"), "2026-01-01");
    assert.equal(url.searchParams.get("end"), "2026-01-31");
    assert.equal(url.searchParams.get("cs"), "34412234,7");
    assert.equal(url.searchParams.get("ss"), "11");
    assert.equal(url.searchParams.get("pagination_token"), "cursor-1");
    assert.equal(url.searchParams.get("page_size"), "25");
    assert.equal(url.searchParams.get("sort_order"), "publish_date");
  });

  it("fetches and normalizes Media Cloud candidates", async () => {
    process.env.MEDIACLOUD_API_KEY = "test-mediacloud-key";
    let seenUrl = "";
    const result = await fetchMediaCloudStoryList(
      {
        query: "illiberal democracy",
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      },
      (async (input, init) => {
        seenUrl = String(input);
        assert.equal((init?.headers as Record<string, string>).Authorization, "Token test-mediacloud-key");
        return new Response(
          JSON.stringify({
            stories: [
              {
                id: 123,
                url: "https://example.com/story",
                title: "Story",
                publish_date: "2026-01-05",
              },
            ],
            pagination_token: "cursor-next",
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }) as typeof fetch,
    );

    assert.equal(seenUrl.includes("illiberal"), true);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.external_id, "123");
    assert.equal(result.pagination_token, "cursor-next");
  });

  it("retries transient Media Cloud rate limits", async function () {
    this.timeout(5_000);
    process.env.MEDIACLOUD_API_KEY = "test-mediacloud-key";
    let attempts = 0;
    const result = await fetchMediaCloudStoryList(
      {
        query: "rate limited query",
        start_date: "2026-01-01",
        end_date: "2026-01-31",
      },
      (async () => {
        attempts += 1;
        if (attempts < 3) {
          return new Response("slow down", { status: 429 });
        }
        return new Response(
          JSON.stringify({
            stories: [
              {
                id: 456,
                url: "https://example.com/retried-story",
              },
            ],
            pagination_token: null,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        );
      }) as unknown as typeof fetch,
    );

    assert.equal(attempts, 3);
    assert.equal(result.candidates[0]?.external_id, "456");
  });

  it("runs one acquisition cycle and persists discovery plus hydration through the worker client contract", async () => {
    const persistedHydrations: string[] = [];
    const markedFailures: string[] = [];
    const result = await runEvidenceAcquisitionCycleActivity(
      "acquisition_123",
      {
        convex: {
          getAcquisitionRunExecutionContext: async () => ({
            acquisition_run_id: "acquisition_123",
            acquisition_spec_id: "spec_123",
            universe_id: "universe_123",
            spec_tag: "demo",
            discovery_provider: "mediacloud",
            discovery_config_json: JSON.stringify({
              query: "democratic erosion",
              start_date: "2026-01-01",
              end_date: "2026-01-31",
              page_size: 1,
            }),
            hydrator_kind: "url_fetch",
            hydrator_config_json: null,
            status: "queued",
            cursor_json: null,
            discovered_count: 0,
            hydrated_count: 0,
            error_count: 0,
            workflow_id: null,
            workflow_run_id: null,
            last_error_message: null,
          }),
          markAcquisitionRunRunning: async () => null,
          finalizeAcquisitionRun: async () => null,
          markAcquisitionRunError: async () => null,
          persistMediaCloudDiscoveryBatch: async () => ({
            inserted: 1,
            updated: 0,
            total: 1,
            candidate_ids: ["candidate_123"],
            pagination_token: null,
          }),
          persistCandidateHydration: async (args) => {
            persistedHydrations.push(args.candidate_id);
            return {
              evidence_item_id: "item_123",
              source_text_record_id: "record_text_123",
              source_html_record_id: "record_html_123",
              raw_text_asset_id: "asset_text_123",
              raw_html_asset_id: "asset_html_123",
              action: "created" as const,
            };
          },
          markCandidateHydrationFailure: async (args) => {
            markedFailures.push(args.candidate_id);
            return null;
          },
        },
        fetchMediaCloudStoryList: async () => ({
          candidates: [
            {
              external_id: "story-123",
              url: "https://example.com/story-123",
              title: "Story 123",
              publish_date: "2026-01-05",
              indexed_date: null,
              media_name: "Example News",
              media_url: null,
              language: "en",
              metadata_json: "{\"id\":123}",
            },
          ],
          pagination_token: null,
        }),
        fetchImpl: (async (input) => {
          assert.equal(String(input), "https://example.com/story-123");
          return new Response("<p>Hydrated story body</p>", {
            status: 200,
            headers: {
              "content-type": "text/html",
            },
          });
        }) as typeof fetch,
      },
    );

    assert.equal(result.completed, true);
    assert.equal(result.discovered, 1);
    assert.equal(result.hydrated, 1);
    assert.deepEqual(persistedHydrations, ["candidate_123"]);
    assert.deepEqual(markedFailures, []);
  });

  it("treats max_pages as a hard completion boundary for bounded smokes", async () => {
    const finalizedRuns: string[] = [];
    const persistedPageCounts: number[] = [];
    const result = await runEvidenceAcquisitionCycleActivity(
      "acquisition_page_budget",
      {
        convex: {
          getAcquisitionRunExecutionContext: async () => ({
            acquisition_run_id: "acquisition_page_budget",
            acquisition_spec_id: "spec_page_budget",
            universe_id: "universe_page_budget",
            spec_tag: "demo",
            discovery_provider: "mediacloud",
            discovery_config_json: JSON.stringify({
              query: "bounded smoke",
              start_date: "2026-01-01",
              end_date: "2026-01-31",
              page_size: 1,
              max_pages: 1,
            }),
            hydrator_kind: "none",
            hydrator_config_json: null,
            status: "queued",
            cursor_json: null,
            discovered_count: 0,
            hydrated_count: 0,
            error_count: 0,
            workflow_id: null,
            workflow_run_id: null,
            last_error_message: null,
          }),
          markAcquisitionRunRunning: async () => null,
          finalizeAcquisitionRun: async (args) => {
            finalizedRuns.push(args.acquisition_run_id);
            return null;
          },
          markAcquisitionRunError: async () => null,
          persistMediaCloudDiscoveryBatch: async (args) => {
            persistedPageCounts.push(args.page_count ?? -1);
            return {
              inserted: 1,
              updated: 0,
              total: 1,
              candidate_ids: ["candidate_123"],
              pagination_token: "cursor-next",
            };
          },
          persistCandidateHydration: async () => {
            throw new Error("should not hydrate when hydrator_kind=none");
          },
          markCandidateHydrationFailure: async () => null,
        },
        fetchMediaCloudStoryList: async () => ({
          candidates: [
            {
              external_id: "story-123",
              url: "https://example.com/story-123",
              title: "Story 123",
              publish_date: "2026-01-05",
              indexed_date: null,
              media_name: "Example News",
              media_url: null,
              language: "en",
              metadata_json: "{\"id\":123}",
            },
          ],
          pagination_token: "cursor-next",
        }),
        fetchImpl: fetch,
      },
    );

    assert.equal(result.completed, true);
    assert.deepEqual(finalizedRuns, ["acquisition_page_budget"]);
    assert.deepEqual(persistedPageCounts, [1]);
  });
});
