# Media Cloud Source Replacement Plan

## Recommendation

Do not treat Media Cloud as a drop-in replacement for the current Firecrawl `search -> title/url/raw_content` contract.

Treat Media Cloud as the new **discovery and source-selection layer**, and treat content acquisition as a separate **hydration/fetch layer**.

## Why

The current engine assumes a single provider can:

- run the search
- enforce date and geography filters
- return the candidate URL and title
- also return full-enough article text for durable storage and L1/L2/L3 processing

That is exactly what the current Firecrawl path does. Media Cloud should not be forced into that interface.

## Wave-1 Architecture

1. `DiscoveryProvider`
   - first implementation: `MediaCloud`
   - responsibilities:
     - query execution
     - collection/source filtering
     - date filtering
     - candidate pagination
     - metadata return

2. `ContentFetcher`
   - first implementation: Firecrawl-as-fetcher or another URL fetch/extraction layer
   - responsibilities:
     - fetch by URL
     - extract text
     - return durable raw content plus fetch metadata

3. `EvidenceCandidate`
   - a discovered but not-yet-hydrated row
   - should carry:
     - external provider id
     - external story id
     - title
     - url
     - publish/index dates
     - outlet/source metadata
     - language

4. `HydratedEvidence`
   - the fetched content record that can feed semantic processing

## Schema Implications

The V4 evidence plan needs one new distinction:

- candidate discovery metadata
- fetched raw content

That means the minimal evidence substrate should not just store `raw_payload`; it should also preserve the pre-fetch candidate identity and provenance that came from the discovery layer.

## Runtime Implications

- window collection can no longer assume one call returns raw content
- collection becomes:
  - discover
  - page / throttle
  - hydrate selected URLs
  - persist fetched content
- observability should log discovery attempts and fetch attempts separately

## Migration Plan

1. keep current Firecrawl path untouched for legacy windows
2. add a V4-only discovery/fetch split
3. implement Media Cloud discovery first
4. reuse Firecrawl only as a URL fetcher at first
5. only after that decide whether Firecrawl should be removed entirely

## Practical Conclusion

The right move is **hybridization**, not a literal one-for-one swap. Media Cloud should replace Firecrawl as the search/discovery system. Firecrawl should be demoted from “search provider” to “content fetcher” until or unless a better hydration layer replaces it.
