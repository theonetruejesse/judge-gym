# V4 Native Fascism Boundary Set

This is the next native V4 evidence set for the U.S. fascism-boundary study.

It is designed to replace the earlier broad native screen that used the simpler query:

- `"fascism" OR "illiberal democracy"`

The point of this set is not to change the core V4 research question. The point is to make the native evidence substrate more diagnostic for the substantive boundary we actually care about: what kinds of U.S. political evidence models treat as fascism.

## Live Catalog

- universe tag: `v4_native_fascism_boundary_universe_v1`
- universe id: `p1777pb34x68ayfnnph8zcaxqs848mdf`
- curated evidence set tag: `v4_native_fascism_boundary_v1_set`
- curated evidence set id: `pd78yjqwtpz6w9rhf0y0r77a2s848zva`
- snapshot evidence set tag: `v4_native_fascism_boundary_v1_snapshot_20260405T235009Z`
- snapshot evidence set id: `pd7a130pymmwak6zdr35jbymsh849082`
- acquisition run id: `nd70p4ckajn1x7dpmmcpv4hshh848bd6`

Acquisition result:

- discovered candidates: `250`
- hydrated candidates: `246`
- canonical evidence items: `250`
- curated study set size: `48`

## Acquisition Shape

The live query keeps the U.S. National Media Cloud collection and adds institutional anchors plus entertainment suppression:

- concept terms:
  - `fascism`
  - `fascist`
  - `authoritarian`
  - `authoritarianism`
  - `autocracy`
  - `illiberal democracy`
  - `democratic backsliding`
  - `democratic erosion`
  - `enemy within`
- U.S. political anchors:
  - `Trump`
  - `White House`
  - `administration`
  - `president`
  - `executive order`
  - `Congress`
  - `Supreme Court`
  - `court`
  - `judge`
  - `DOJ`
  - `Justice Department`
  - `ICE`
  - `immigration`
  - `deportation`
  - `protest`
  - `demonstration`
  - `policing`
  - `National Guard`
  - `election`
  - `voting`
  - `constitution`
  - `rule of law`
  - `journalist`
  - `media`
  - `press`
  - `censorship`
  - `university`
  - `campus`
- suppressed spillover:
  - `movie`
  - `film`
  - `comic`
  - `album`
  - `music`
  - `song`
  - `television`
  - `TV`
  - `trailer`
  - `game`
  - `sports`
  - `fashion`
  - `celebrity`
  - `review`
  - `festival`
  - `starwars`

Window and collection:

- collection: U.S. National (`34412234`)
- locale: English
- lookback window: `240` days
- page size: `50`
- max pages: `5`

## Curation Policy

The curated set uses:

- required record kind: `source_text`
- min char count: `1200`
- max char count: `12000`
- max items per source: `2`

Score adjustments:

- concept-frame boost: `+10`
- institutional-anchor boost: `+8`
- entertainment-spillover penalty: `-18`

Bucket quotas:

- `executive_power`: `8`
- `immigration_enforcement`: `8`
- `protest_policing`: `8`
- `elections_courts`: `8`
- `media_institutions`: `8`
- `explicit_frame`: `8`

## Current Read

This set is materially better than the earlier native screen. It is more U.S.-politics-facing, more institutional, and much more aligned with the substantive fascism-boundary question.

It is still not perfect.

There is visible leakage in the current 48-item set:

- some international-authoritarian material remains
- some culture/commentary spillover remains
- some items are clearly adjacent to the boundary question rather than central examples of it

So this set should be treated as:

- a real frozen native study set
- ready for immediate review and rerun planning
- not yet assumed to be the final polished fascism corpus without a quick human audit

## Next Use

This set is the right basis for the next native rerun pass once we:

1. patch the current OpenRouter parser robustness issues,
2. manually review the 48 selected items,
3. decide whether to prune or replace any obvious leakage cases,
4. then rerun the native matrix on this frozen set.
