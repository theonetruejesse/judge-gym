# Phased Roadmap

## Phase 1: Scope Lock

- lock the wave-1 paper spine
- decide whether comparator work is deferred
- choose exactly two perturbation families
- decide whether the first non-OpenAI slice is in or out

Gate:
- if wave 1 still depends on comparator support or multi-provider headline claims, stop and rescope

## Phase 2: Minimal Evidence Substrate

- add the smallest import-ready evidence core
- preserve legacy windows intact
- ensure imported items can be rendered consistently into scoring prompts
- define the discovered-candidate vs hydrated-content split if Media Cloud becomes the query layer

Gate:
- if imported audit items still require ad hoc per-paper handling, the substrate is not yet minimal enough

## Phase 3: Prompt/Config Bridge

- add imported/frozen rubric support
- add explicit adjudication task typing
- add strict output contracts and compatibility logging

Gate:
- if wave 1 requires a generic stage runner, stop and decide whether the platform rewrite is actually justified

## Phase 3A: Discovery/Hydration Refactor

- add a discovery-provider contract
- add a content-fetcher contract
- implement Media Cloud discovery without removing legacy Firecrawl search
- demote Firecrawl to a fetch/hydration role first

Gate:
- if discovery and hydration are still coupled in one provider-specific interface, the source refactor is not actually done

## Phase 4: Provider Scaffold

- wrap OpenAI behind the new adapter seam
- add one non-OpenAI direct-only adapter if the study still needs it

Gate:
- if throughput requires provider-native batching, elevate that as a separate refactor rather than hiding it inside “provider support”

## Phase 5: Wave-1 Study Matrix And Paper Assets

- finalize the exact sample set
- finalize baseline and perturbation configs
- create paper outline, figures, and reporting checklist

Gate:
- if faithful reconstruction artifacts are missing, demote the target before implementation effort expands
