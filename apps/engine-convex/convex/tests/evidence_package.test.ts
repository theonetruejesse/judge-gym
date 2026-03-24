import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { api } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("evidence package", () => {
  beforeEach(() => {
    process.env.MEDIACLOUD_API_KEY = "test-mediacloud-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates a universe/spec/run and drives ingest + hydration through the public API", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(api.packages.evidence.createEvidenceUniverse, {
      universe_tag: "package-flow",
      kind: "news",
      title: "Package flow universe",
    });
    const { acquisition_spec_id } = await t.mutation(api.packages.evidence.createAcquisitionSpec, {
      universe_id,
      spec_tag: "package-flow-spec",
      discovery_provider: "mediacloud",
      discovery_config_json: JSON.stringify({
        query: "democracy",
        start_date: "2026-03-01",
        end_date: "2026-03-05",
        collection_ids: [34412234],
      }),
      hydrator_kind: "manual",
      active: true,
    });
    const { acquisition_run_id } = await t.mutation(api.packages.evidence.createAcquisitionRun, {
      acquisition_spec_id,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("search/story-list")) {
          return new Response(
            JSON.stringify({
              stories: [
                {
                  id: 88,
                  url: "https://example.com/story-88",
                  title: "Story Eighty Eight",
                  publish_date: "2026-03-03",
                  indexed_date: "2026-03-03T09:00:00Z",
                  media_name: "Example Outlet",
                  media_url: "https://example.com",
                  language: "en",
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
        }

        return new Response(
          `
            <html>
              <body>
                <article>
                  <h1>Story Eighty Eight</h1>
                  <p>Lead paragraph.</p>
                </article>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          },
        );
      }),
    );

    const ingest = await t.action(api.packages.evidence.ingestAcquisitionRun, {
      acquisition_run_id,
    });
    expect(ingest.inserted).toBe(1);

    const hydrate = await t.action(api.packages.evidence.hydrateAcquisitionRun, {
      acquisition_run_id,
      limit: 5,
    });
    expect(hydrate.hydrated).toBe(1);

    const universeSummary = await t.query(api.packages.evidence.getEvidenceUniverseSummary, {
      universe_id,
    });
    expect(universeSummary.candidate_count).toBe(1);
    expect(universeSummary.item_count).toBe(1);

    const runSummary = await t.query(api.packages.evidence.getAcquisitionRunSummary, {
      acquisition_run_id,
    });
    expect(runSummary.discovered_count).toBe(1);
    expect(runSummary.hydrated_count).toBe(1);
  });
});
