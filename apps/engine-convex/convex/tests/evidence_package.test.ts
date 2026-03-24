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
    expect(universeSummary.evidence_set_count).toBe(0);

    const runSummary = await t.query(api.packages.evidence.getAcquisitionRunSummary, {
      acquisition_run_id,
    });
    expect(runSummary.discovered_count).toBe(1);
    expect(runSummary.hydrated_count).toBe(1);
  });

  test("imports direct evidence items and curates them into an evidence set", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(api.packages.evidence.createEvidenceUniverse, {
      universe_tag: "paper-audit-import",
      kind: "paper_audit",
      title: "Paper audit import",
    });

    const imported = await t.action(api.packages.evidence.importEvidenceItem, {
      universe_id,
      canonical_key: "gilardi:dataset:row-001",
      title: "Annotated article excerpt",
      source_url: "https://example.com/paper-audit/row-001",
      source_name: "Gilardi replication bundle",
      publish_date: "2024-01-10",
      language: "en",
      raw_text: "A coded excerpt for compatibility testing.",
      view_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "paper-audit-v1",
    });

    const { evidence_set_id } = await t.mutation(api.packages.evidence.createEvidenceSet, {
      universe_id,
      evidence_set_tag: "gilardi-core",
      title: "Gilardi core audit set",
      source_kind: "literature_dataset",
      quality_label: "high",
    });

    const addResult = await t.mutation(api.packages.evidence.addEvidenceSetItems, {
      evidence_set_id,
      items: [
        {
          evidence_item_id: imported.evidence_item_id,
          pinned_view_id: imported.evidence_view_id,
          ordinal: 0,
          inclusion_reason: "Core compatibility row",
          quality_label: "high",
        },
      ],
    });

    expect(addResult.inserted).toBe(1);

    const universeSummary = await t.query(api.packages.evidence.getEvidenceUniverseSummary, {
      universe_id,
    });
    expect(universeSummary.item_count).toBe(1);
    expect(universeSummary.evidence_set_count).toBe(1);

    const evidenceSetSummary = await t.query(api.packages.evidence.getEvidenceSetSummary, {
      evidence_set_id,
    });
    expect(evidenceSetSummary.item_count).toBe(1);
    expect(evidenceSetSummary.source_kind).toBe("literature_dataset");

    const catalog = await t.query(api.packages.evidence.listEvidenceSets, {});
    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.evidence_set_id).toBe(evidence_set_id);
    expect(catalog[0]?.universe_tag).toBe("paper-audit-import");

    const setItems = await t.query(api.packages.evidence.listEvidenceSetItems, {
      evidence_set_id,
    });
    expect(setItems).toHaveLength(1);
    expect(setItems[0]?.title).toBe("Annotated article excerpt");
    expect(setItems[0]?.pinned_view_id).toBe(imported.evidence_view_id);
  });

  test("lists universes and acquisition runs, snapshots a run into an evidence set, and loads content", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(api.packages.evidence.createEvidenceUniverse, {
      universe_tag: "mediacloud-lab",
      kind: "news",
      title: "Media Cloud lab",
    });
    const { acquisition_spec_id } = await t.mutation(api.packages.evidence.createAcquisitionSpec, {
      universe_id,
      spec_tag: "mediacloud-lab-spec",
      discovery_provider: "mediacloud",
      discovery_config_json: JSON.stringify({
        query: "democratic erosion",
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
                  id: 101,
                  url: "https://example.com/story-101",
                  title: "Story One Zero One",
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
              headers: { "content-type": "application/json" },
            },
          );
        }
        if (url.includes("example.com/story-101")) {
          return new Response(
            "<html><body><article><p>Hydrated Media Cloud story.</p></article></body></html>",
            {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8" },
            },
          );
        }
        return new Response("Stored evidence text.", { status: 200 });
      }),
    );

    await t.action(api.packages.evidence.ingestAcquisitionRun, {
      acquisition_run_id,
    });
    await t.action(api.packages.evidence.hydrateAcquisitionRun, {
      acquisition_run_id,
      limit: 5,
    });

    const universes = await t.query(api.packages.evidence.listEvidenceUniverses, {});
    expect(universes).toHaveLength(1);
    expect(universes[0]?.latest_acquisition_run_id).toBe(acquisition_run_id);

    const runs = await t.query(api.packages.evidence.listAcquisitionRuns, {
      universe_id,
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.spec_tag).toBe("mediacloud-lab-spec");

    const setSnapshot = await t.mutation(api.packages.evidence.createEvidenceSetFromAcquisitionRun, {
      acquisition_run_id,
      evidence_set_tag: "mediacloud-lab-set",
      title: "Media Cloud lab set",
    });
    expect(setSnapshot.item_count).toBe(1);

    const universeItems = await t.query(api.packages.evidence.listUniverseItems, {
      universe_id,
    });
    expect(universeItems).toHaveLength(1);
    expect(universeItems[0]?.title).toBe("Story One Zero One");

    const content = await t.action(api.packages.evidence.getEvidenceItemContent, {
      evidence_item_id: universeItems[0]!.evidence_item_id,
    });
    expect(content.raw_text).toBe("Stored evidence text.");
  });
});
