# Media Cloud As A Firecrawl Replacement (V4 Source/Discovery Plan)

## current assumptions

The current “window collect” path in judge-gym assumes a *single provider* can do both discovery and content retrieval in one call, and that the result includes full-enough article text to feed the L1/L2/L3 semantic pipeline.

Grounded in the repo:

- `windows.source_provider` is an enum with only `"firecrawl"` today (`apps/engine-convex/convex/models/window.ts`), so the data model currently encodes “exactly one provider and it is Firecrawl.”
- Evidence search is a Convex Node action that calls Firecrawl search directly (`apps/engine-convex/convex/domain/window/evidence_search.ts`):
  - It uses `firecrawl.search(...)` with `sources`, `location` (country), and a date range filter via `tbs: cdr:1,cd_min:...,cd_max:...`.
  - It requests scraping at search time via `scrapeOptions: { formats: ["markdown"] }`.
  - It assumes the response has per-result `title`, `url`, and *non-empty* `markdown` content.
- Temporal “collect” (`apps/engine-temporal/src/window/service.ts`) assumes `searchWindowEvidence` returns `[{ title, url, raw_content }]` where `raw_content` is directly insertable as `evidences.l0_raw_content`.
- Convex insertion dedupes only on URL and stores only `title`, `url`, `l0_raw_content` (no publish date, outlet, language, crawl metadata, or external IDs) (`apps/engine-convex/convex/domain/window/window_repo.ts`).

Implicit assumptions that matter for a replacement:

- “Discovery” output must be *content-bearing* (or the engine must be refactored to add a separate “fetch” phase).
- The engine treats evidence text as *available and legally re-storable* (it persists `l0_raw_content` durably).
- The query model is simple: `(query, country, start_date, end_date, limit)` with no first-class source/collection selection in the schema.

## Media Cloud capability assessment

Media Cloud is an archive/index with strong *discovery and source selection* features, but it is not positioned as a general web scraper that can hand back full story text for downstream redistribution/storage.

### Official API surface (v4)

- Official Python client targets “MediaCloud API v4.” It uses base URL `https://api.mediacloud.org/api/v4/` and authenticates with an `Authorization: Token <api_key>` header. (Official client code: https://github.com/mediacloud/api-client/blob/main/mediacloud/api.py)
- Search endpoints exposed by the official client include:
  - `search/story-list` returning `stories` plus a `pagination_token` (cursor-style pagination).
  - `search/sample` returning a sampled list (supports a `fields` list; the client’s default fields include `indexed_date`, `publish_date`, `id`, `language`, `media_name`, `media_url`, `title`, `url`). (Same client file; see `story_list` / `story_sample`.)
  - `search/story` for fetching a single story record by ID.
  - Aggregate endpoints like `search/total-count`, `search/count-over-time`, etc. (Same client file.)
- Source/collection selection is first-class:
  - `collection_ids` and `source_ids` are supported filters in the official client for story listing/sample. (Same client file.)
  - “Collections” are a core concept in the Directory, with documented bulk update flows and a structured Source/Collection model. (Official docs: https://www.mediacloud.org/documentation/batch-updating-collections and https://www.mediacloud.org/documentation/source-guide)

### Auth, quota, and rate limits

- Media Cloud documents a default quota of **4000 API requests per week**, and that **certain API endpoints are rate-limited to 2 requests per minute**. (Official FAQ: https://www.mediacloud.org/documentation/faqs)

### Story fields and full-text availability

- Media Cloud is explicit that **it cannot release “the actual text of a story” due to copyright restrictions**, but it can provide URLs and metadata. (Official FAQ: https://www.mediacloud.org/documentation/faqs)
- The Story Guide describes the story object shape and notes that extracted story text is used internally for search but is *not available for download* due to copyright restrictions. (Official Story Guide: https://www.mediacloud.org/documentation/story-guide)
- The official Python client reinforces this constraint: its `story_sample(..., expanded=True)` path contains a comment indicating full text access is “STILL UNSUPPORTED,” with a note that “admins can query full text if they choose to.” (Official client code: https://github.com/mediacloud/api-client/blob/main/mediacloud/api.py)

### Replacement conclusion (capability match vs Firecrawl)

Media Cloud can plausibly replace the *discovery/indexing* part of Firecrawl (finding relevant story URLs with strong source/collection controls), but it cannot replace the *content retrieval* contract judge-gym currently requires for L0/L1/L2/L3 processing and durable storage.

So: Media Cloud is a discovery/query layer, not a “search+scrape-to-markdown” replacement under judge-gym’s current assumptions.

## recommended integration architecture

The right V4 shape is to explicitly split “discovery” from “content retrieval,” and treat them as composable providers.

### Proposed provider split

1. **Discovery provider (returns candidates, not text)**
   - `MediaCloudDiscoveryProvider`:
     - Inputs: `query`, `start_date`, `end_date`, plus *source selection* (`collection_ids` and/or `source_ids`), optional `language`, optional `sort_order`, and `page_size`.
     - Outputs: a list of `EvidenceCandidate` records (URL + stable external ID + metadata), plus a `pagination_token` for resuming.

2. **Content fetch provider (hydrates candidates into text)**
   - Keep Firecrawl, but use it as a *scraper* for known URLs (not as a search engine), or swap in another fetcher if we want to reduce dependency:
     - `FirecrawlContentFetcher`: `scrape(url) -> markdown/text + fetch metadata`.
     - Alternative fetchers for later V4: Playwright/Browserless, Readability-based extraction, newspaper3k (Python), etc.

### Pipeline refactor (window collect becomes 2-stage)

Replace the single `searchNews(...) -> [{title,url,raw_content}]` with:

1. `discoverCandidates(...) -> { candidates: EvidenceCandidate[], next_pagination_token }`
2. `fetchContent(candidate.url) -> { raw_content, fetch_status, fetch_error, fetched_at }`
3. `insertEvidenceBatch(...)` only for successfully fetched candidates (or insert candidates first, then patch in fetched content)

This architecture makes Media Cloud a first-class discovery engine without forcing it to violate its own “no story text download” constraint.

## schema/runtime implications

Media Cloud’s strengths (stable IDs, collections, source metadata) are wasted if we continue to store only `(title,url,l0_raw_content)`. The V4 evidence refactor should treat discovery metadata as durable and separately auditable from fetched content.

### Minimal new concepts (to support Media Cloud cleanly)

- **Evidence universe definition** (replaces or generalizes `windows`):
  - `discovery_provider`: `"mediacloud"` | ... (future)
  - `discovery_config`: query, date range, collection_ids/source_ids, sort, language, page_size
  - `content_provider`: `"firecrawl"` | ... (future)
  - Goal: a universe can be re-run deterministically, and can be audited for “what sources were eligible.”

- **Evidence candidate** (new; discovered but not yet hydrated):
  - `external_provider`: `"mediacloud"`
  - `external_id`: Media Cloud story `id`
  - `url`, `title`
  - metadata fields worth capturing at discovery time:
    - `publish_date`, `indexed_date`
    - `media_name`, `media_url`
    - `language`
    - `matched_query` (optional), `collection_ids`/`source_ids` used (optional)
  - `discovery_pagination_token` (or a separate universe-run cursor state)

- **Evidence content fetch record** (new, or additional fields on evidence):
  - `content_provider`: `"firecrawl"` (or other)
  - `fetch_status`: succeeded/failed
  - `fetched_at`, `http_status` (if available), `content_hash`, `content_type`
  - `raw_content` (what is currently `l0_raw_content`)

### Runtime implications

- **Pagination is required**: Media Cloud’s intended access pattern is “page until `pagination_token` is `None`,” not “set a `limit` and get scraped content back.” This changes Temporal’s collect activity behavior: it must support cursoring and stateful resume.
- **Rate limiting must be enforced**: With endpoints at 2 requests/minute (per docs) and a weekly quota, any “collect N=500” window needs careful paging and caching; we should treat discovery calls as a throttled external dependency like LLM calls.
- **Observability should treat discovery/fetch as first-class attempts**: The repo already has `llm_attempts.operation_type` including `"search"`; V4 should record discovery and fetch attempts (even if they aren’t “LLM”) so windows can be debugged with the same tooling and durable audit trail as LLM stages.

## migration plan

### Recommendation: do not attempt a drop-in swap in the existing V3 window code

Because the current `searchNews` contract is “return title/url/raw_content,” Media Cloud cannot be inserted behind that interface without also refactoring the collect stage to add content fetching.

### Practical V4 migration path

1. **Add an explicit discovery vs fetch abstraction in the V4 evidence blueprint**
   - Deliverable to add to the V4 blueprint:
     - “Evidence acquisition provider interface” spec with a capability matrix:
       - Discovery: query language, date filters, source collections, pagination model, quotas
       - Fetch: HTML access, paywall handling, extraction format, throughput/rate limiting
     - Include a “Media Cloud adapter plan” mapping `story-list` fields to the new candidate schema.

2. **Implement Media Cloud discovery first (no content fetching changes)**
   - Build a thin adapter that produces `EvidenceCandidate` objects and persists them.
   - Validate that collection_ids/source_ids and date filtering match intended study windows.

3. **Implement URL hydration second**
   - Use Firecrawl (scrape-by-URL) or another fetcher to populate `raw_content` for candidates.
   - Only then run the existing L1/L2/L3 transforms over hydrated content.

4. **Deprecate Firecrawl “search+scrape” only after the hybrid pipeline is stable**
   - Once Media Cloud discovery is reliable, Firecrawl can be reduced to a fetcher role (or replaced).

## verdict

**Hybridize.** Use Media Cloud as a discovery/index layer (querying story URLs with collection/source selection and stable IDs), and keep a separate content retrieval provider (Firecrawl scrape or an alternative) to produce the durable text that judge-gym’s evidence pipeline requires.
