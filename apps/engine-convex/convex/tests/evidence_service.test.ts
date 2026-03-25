import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";
import { extractTextFromHtml } from "../domain/evidence/evidence_service";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("evidence service", () => {
  beforeEach(() => {
    process.env.MEDIACLOUD_API_KEY = "test-mediacloud-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("extractTextFromHtml removes markup and preserves readable blocks", () => {
    const text = extractTextFromHtml(`
      <html>
        <body>
          <article>
            <h1>Headline</h1>
            <p>Lead <strong>paragraph</strong>.</p>
            <script>window.bad = true;</script>
            <div>Second block<br/>with line break.</div>
          </article>
        </body>
      </html>
    `);

    expect(text).toContain("Headline");
    expect(text).toContain("Lead paragraph.");
    expect(text).toContain("Second block");
    expect(text).toContain("with line break.");
    expect(text).not.toContain("window.bad");
  });

  test("storeTextAsset persists storage-backed assets and dedupes by role + content hash", async () => {
    const t = initTest();

    const first = await t.action(internal.domain.evidence.evidence_service.storeTextAsset, {
      content: "hello world",
      role: "raw_text",
      mime_type: "text/plain",
      encoding: "utf-8",
    });
    const second = await t.action(internal.domain.evidence.evidence_service.storeTextAsset, {
      content: "hello world",
      role: "raw_text",
      mime_type: "text/plain",
      encoding: "utf-8",
    });

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.asset_id).toBe(first.asset_id);

    const asset = await t.query(internal.domain.evidence.evidence_repo.getAssetByContentHash, {
      content_hash: first.content_hash,
      role: "raw_text",
    });
    expect(asset?._id).toBe(first.asset_id);
    expect(asset?.storage_id).toBe(first.storage_id);
  });

  test("ingestMediaCloudDiscoveryRun stores candidates and provider payload assets", async () => {
    const t = initTest();
    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "mediacloud-ingest",
      kind: "news",
      title: "Media Cloud ingest test",
    });
    const { acquisition_spec_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionSpec,
      {
        universe_id,
        spec_tag: "mc-spec",
        discovery_provider: "mediacloud",
        discovery_config_json: JSON.stringify({
          query: "trump",
          start_date: "2026-03-01",
          end_date: "2026-03-05",
          collection_ids: [34412234],
        }),
        hydrator_kind: "none",
      },
    );
    const { acquisition_run_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionRun,
      {
        acquisition_spec_id,
      },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            stories: [
              {
                id: 42,
                url: "https://example.com/story-42",
                title: "Story Forty Two",
                publish_date: "2026-03-02",
                indexed_date: "2026-03-02T10:00:00Z",
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
        ),
      ),
    );

    const result = await t.action(
      internal.domain.evidence.evidence_service.ingestMediaCloudDiscoveryRun,
      {
        acquisition_run_id,
      },
    );

    expect(result.inserted).toBe(1);
    expect(result.pagination_token).toBeNull();

    const candidates = await t.query(internal.domain.evidence.evidence_repo.listUniverseCandidates, {
      universe_id,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.external_id).toBe("42");
    expect(candidates[0]?.provider_payload_asset_id).toBeTruthy();
  });

  test("hydrateCandidate stores raw html/raw text as source records", async () => {
    const t = initTest();
    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "hydrate-candidate",
      kind: "news",
      title: "Hydrate candidate",
    });
    const { acquisition_spec_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionSpec,
      {
        universe_id,
        spec_tag: "hydrate-spec",
        discovery_provider: "manual",
        discovery_config_json: "{}",
        hydrator_kind: "manual",
      },
    );
    const { acquisition_run_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionRun,
      {
        acquisition_spec_id,
      },
    );
    const candidateBatch = await t.mutation(
      internal.domain.evidence.evidence_repo.upsertCandidates,
      {
        universe_id,
        acquisition_run_id,
        candidates: [
          {
            discovery_provider: "manual",
            external_id: "story-html-1",
            url: "https://example.com/story-html-1",
            title: "Hydrate me",
          },
        ],
      },
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          `
            <html>
              <body>
                <article>
                  <h1>Headline</h1>
                  <p>Paragraph one.</p>
                  <p>Paragraph two.</p>
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
        ),
      ),
    );

    const result = await t.action(internal.domain.evidence.evidence_service.hydrateCandidate, {
      candidate_id: candidateBatch.candidate_ids[0]!,
    });

    expect(result.action).toBe("created");
    expect(result.raw_html_asset_id).toBeTruthy();

    const items = await t.query(internal.domain.evidence.evidence_repo.listUniverseItems, {
      universe_id,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.hydration_status).toBe("hydrated");
    const sourceRecords = await t.query(
      internal.domain.evidence.evidence_repo.listItemSourceRecords,
      { evidence_item_id: items[0]!._id },
    );
    expect(sourceRecords).toHaveLength(2);
    expect(sourceRecords.find((record: (typeof sourceRecords)[number]) => record._id === result.source_text_record_id)?.record_kind).toBe("source_text");
    expect(sourceRecords.find((record: (typeof sourceRecords)[number]) => record._id === result.source_html_record_id)?.record_kind).toBe("source_html");
  });

  test("importEvidenceItem stores direct text imports as hydrated source records", async () => {
    const t = initTest();
    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "direct-import",
      kind: "paper_audit",
      title: "Direct import universe",
    });

    const result = await t.action(internal.domain.evidence.evidence_service.importEvidenceItem, {
      universe_id,
      canonical_key: "direct-import:001",
      title: "Imported excerpt",
      source_url: "https://example.com/direct-import/001",
      source_name: "Replication archive",
      publish_date: "2024-08-20",
      language: "en",
      raw_text: "Imported raw text for regime compatibility testing.",
      raw_html: "<article><p>Imported raw text for regime compatibility testing.</p></article>",
      source_record_kind: "paper_original",
      pipeline_kind: "import",
      pipeline_version: "paper-import-v1",
    });

    expect(result.action).toBe("created");
    expect(result.raw_html_asset_id).toBeTruthy();

    const items = await t.query(internal.domain.evidence.evidence_repo.listUniverseItems, {
      universe_id,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe("Imported excerpt");
    expect(items[0]?.source_url).toBe("https://example.com/direct-import/001");
    expect(items[0]?.source_name).toBe("Replication archive");
    expect(items[0]?.hydration_status).toBe("hydrated");
    const sourceRecords = await t.query(
      internal.domain.evidence.evidence_repo.listItemSourceRecords,
      { evidence_item_id: items[0]!._id },
    );
    expect(sourceRecords.find((record: (typeof sourceRecords)[number]) => record._id === result.source_record_id)?.record_kind).toBe("paper_original");
    expect(sourceRecords.find((record: (typeof sourceRecords)[number]) => record._id === result.source_html_record_id)?.record_kind).toBe("source_html");
  });
});
