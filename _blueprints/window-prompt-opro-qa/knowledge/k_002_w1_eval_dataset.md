# W1 QA Dataset Snapshot

**Confidence:** 0.92

**Sources:**
- Convex ownDev deployment, window `jx72bqckawnnemjmzyyzx721t9829npe`
- `packages/lab:listEvidenceByWindow`
- `mcp__convex__runOneoffQuery` extraction of `l0/l1/l2/l3`

**Summary:**
Two evidence items were processed through L1/L2/L3. Item A (PBS Jan 6 report) shows very aggressive L1 truncation and moderate L2/L3 expansion. Item B (Gallup predictions) preserves long table-heavy text in L1 and remains verbose in L2/L3. This confirms stage inconsistency and motivates fidelity-first prompt refinement focused on controlled compression and anti-expansion for L2/L3.

## Item A lengths
- l0: 18921
- l1: 363
- l2: 384
- l3: 473

## Item B lengths
- l0: 22400
- l1: 11617
- l2: 3758
- l3: 4204

## Noted quality issues
- L2/L3 can over-include methodology/meta details in long survey/news pieces.
- L3 sometimes expands relative to L2 while adding limited abstraction value.
- L1 behavior is acceptable by design if it remains faithful to main article body.
