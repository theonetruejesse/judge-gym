import { describe, expect, test } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { buildModules } from "./test.setup";
import { internal } from "../_generated/api";

function initTest() {
  return convexTest(schema, buildModules());
}

describe("evidence repository", () => {
  test("creates a universe, acquisition spec, run, candidates, item, and view", async () => {
    const t = initTest();

    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "mediacloud-news-us",
      kind: "news",
      title: "Media Cloud US News",
      description: "Greenfield V4 acquisition test",
    });

    const { acquisition_spec_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionSpec,
      {
        universe_id,
        spec_tag: "us-politics-mar-2026",
        discovery_provider: "mediacloud",
        discovery_config_json: JSON.stringify({
          query: "trump",
          collection_ids: [34412234],
          start_date: "2026-03-01",
          end_date: "2026-03-07",
        }),
        hydrator_kind: "manual",
        hydrator_config_json: null,
      },
    );

    const { acquisition_run_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionRun,
      {
        acquisition_spec_id,
      },
    );

    const { asset_id: payload_asset_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAsset,
      {
        storage_id: "storage_provider_payload_1",
        role: "provider_payload",
        mime_type: "application/json",
        byte_size: 256,
        content_hash: "provider_payload_hash",
      },
    );

    const candidateBatch = await t.mutation(
      internal.domain.evidence.evidence_repo.upsertCandidates,
      {
        universe_id,
        acquisition_run_id,
        candidates: [
          {
            discovery_provider: "mediacloud",
            external_id: "story-001",
            url: "https://example.com/story-001",
            title: "Story One",
            publish_date: "2026-03-03T12:00:00Z",
            indexed_date: "2026-03-03T13:00:00Z",
            media_name: "Example News",
            media_url: "https://example.com",
            language: "en",
            metadata_json: JSON.stringify({ collection_ids: [34412234] }),
            provider_payload_asset_id: payload_asset_id,
          },
          {
            discovery_provider: "mediacloud",
            external_id: "story-002",
            url: "https://example.com/story-002",
            title: "Story Two",
            language: "en",
          },
        ],
      },
    );

    expect(candidateBatch.inserted).toBe(2);
    expect(candidateBatch.updated).toBe(0);

    const candidates = await t.query(internal.domain.evidence.evidence_repo.listUniverseCandidates, {
      universe_id,
    });
    expect(candidates).toHaveLength(2);

    const { asset_id: raw_text_asset_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAsset,
      {
        storage_id: "storage_raw_text_1",
        role: "raw_text",
        mime_type: "text/plain",
        encoding: "utf-8",
        byte_size: 1024,
        content_hash: "raw_text_hash",
      },
    );

    const { evidence_item_id, action } = await t.mutation(
      internal.domain.evidence.evidence_repo.upsertItemFromCandidate,
      {
        universe_id,
        candidate_id: candidates[0]!._id,
        canonical_key: "mediacloud:story-001",
        title: "Story One",
        source_url: "https://example.com/story-001",
        source_name: "Example News",
        publish_date: "2026-03-03T12:00:00Z",
        language: "en",
        hydration_status: "hydrated",
        raw_text_asset_id,
        content_hash: "raw_text_hash",
        char_count: 924,
        token_estimate: 220,
        extraction_version: "readability-v1",
      },
    );

    expect(action).toBe("created");

    const { asset_id: cleaned_view_asset_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAsset,
      {
        storage_id: "storage_cleaned_text_1",
        role: "view_text",
        mime_type: "text/plain",
        encoding: "utf-8",
        byte_size: 900,
        content_hash: "cleaned_view_hash",
      },
    );

    const viewResult = await t.mutation(internal.domain.evidence.evidence_repo.upsertView, {
      evidence_item_id,
      view_kind: "cleaned",
      pipeline_kind: "normalize",
      pipeline_version: "v1",
      asset_id: cleaned_view_asset_id,
      status: "completed",
    });

    expect(viewResult.action).toBe("created");

    const items = await t.query(internal.domain.evidence.evidence_repo.listUniverseItems, {
      universe_id,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.hydration_status).toBe("hydrated");
    expect(items[0]?.raw_text_asset_id).toBe(raw_text_asset_id);
    expect(items[0]?.title).toBe("Story One");
    expect(items[0]?.source_url).toBe("https://example.com/story-001");
    expect(items[0]?.source_name).toBe("Example News");

    const { evidence_set_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createEvidenceSet,
      {
        universe_id,
        evidence_set_tag: "quality-core",
        title: "Quality core set",
        source_kind: "universe_slice",
        quality_label: "high",
      },
    );

    const setResult = await t.mutation(
      internal.domain.evidence.evidence_repo.upsertEvidenceSetItems,
      {
        evidence_set_id,
        items: [
          {
            evidence_item_id,
            pinned_view_id: viewResult.evidence_view_id,
            ordinal: 0,
            inclusion_reason: "Representative sample",
            quality_label: "high",
          },
        ],
      },
    );

    expect(setResult.inserted).toBe(1);

    const evidenceSets = await t.query(
      internal.domain.evidence.evidence_repo.listUniverseEvidenceSets,
      {
        universe_id,
      },
    );
    expect(evidenceSets).toHaveLength(1);
    expect(evidenceSets[0]?.item_count).toBe(1);

    const setItems = await t.query(internal.domain.evidence.evidence_repo.listEvidenceSetItems, {
      evidence_set_id,
    });
    expect(setItems).toHaveLength(1);
    expect(setItems[0]?.pinned_view_id).toBe(viewResult.evidence_view_id);
  });

  test("upsertCandidates dedupes by universe, provider, and external id", async () => {
    const t = initTest();
    const { universe_id } = await t.mutation(internal.domain.evidence.evidence_repo.createUniverse, {
      universe_tag: "candidate-dedupe",
      kind: "news",
      title: "Candidate Dedupe",
    });
    const { acquisition_spec_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionSpec,
      {
        universe_id,
        spec_tag: "spec",
        discovery_provider: "mediacloud",
        discovery_config_json: "{}",
        hydrator_kind: "none",
      },
    );
    const { acquisition_run_id } = await t.mutation(
      internal.domain.evidence.evidence_repo.createAcquisitionRun,
      {
        acquisition_spec_id,
      },
    );

    const first = await t.mutation(internal.domain.evidence.evidence_repo.upsertCandidates, {
      universe_id,
      acquisition_run_id,
      candidates: [
        {
          discovery_provider: "mediacloud",
          external_id: "story-001",
          url: "https://example.com/story-001",
          title: "Original",
        },
      ],
    });
    expect(first.inserted).toBe(1);

    const second = await t.mutation(internal.domain.evidence.evidence_repo.upsertCandidates, {
      universe_id,
      acquisition_run_id,
      candidates: [
        {
          discovery_provider: "mediacloud",
          external_id: "story-001",
          url: "https://example.com/story-001-updated",
          title: "Updated",
        },
      ],
    });
    expect(second.inserted).toBe(0);
    expect(second.updated).toBe(1);

    const candidates = await t.query(internal.domain.evidence.evidence_repo.listUniverseCandidates, {
      universe_id,
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.title).toBe("Updated");
    expect(candidates[0]?.url).toBe("https://example.com/story-001-updated");
  });
});
