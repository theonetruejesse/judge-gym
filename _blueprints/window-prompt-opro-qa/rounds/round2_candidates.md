# Round 2 Candidates

## Candidate D
- L1: A-style fidelity cleaner with minimal edit and no paraphrase.
- L2: fidelity-first normalization; anti-expansion <=100%, target 80-95%; preserve all material details.
- L3: strict structural mapper, one-to-one units, no inference, hard non-expansion <=100%.
- Format: plain text outputs (no forced bullets).

## Candidate E
- L1: A-style fidelity cleaner.
- L2: deterministic bulletized neutralization with survey-mode guardrail (8-14 bullets, max 28 words each); 55-85% length target.
- L3: bullet-preserving abstraction with strict per-bullet non-expansion and entity type placeholders.
- Format: forces stage prefixes + bullet structure.

## Round-2 objective
Select the candidate that best balances fidelity-first with anti-expansion reliability for long survey-heavy evidence.
