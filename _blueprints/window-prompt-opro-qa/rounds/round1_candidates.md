# Round 1 Candidates

## Candidate A (Fidelity-preserving minimal edits)
Source agent: 019cbadd-2261...
- L1: Strong preserve-if-unsure; no summarize/paraphrase.
- L2: Edit-light neutralization, preserve order/sentence structure; length 85-105%.
- L3: Targeted substitutions only; preserve attribution/causality; length 90-105%.
- Risk: may preserve too much style/noise.

## Candidate B (Anti-expansion compressor)
Source agent: 019cbadd-227b...
- L1: small cleanup hardening.
- L2: factual compressor, hard caps (<=220 words or 12 bullets), target 35-60%.
- L3: anti-expansion abstraction, <= input and <=200 words or 10 bullets.
- Risk: aggressive compression may drop salient facts.

## Candidate C (L3 strict structural mapper)
Source agent: 019cbadd-22b8...
- Focus: L3 strict dependency on L2; one-to-one placeholder mapping.
- Preserves counts/dates/modality and event relations explicitly.
- L3 length band 0.9-1.1x input.
- Risk: placeholder-heavy readability; relies on L2 quality.

## Baseline quality issues to beat
- L2/L3 verbosity on long survey piece.
- L3 can expand relative to L2.
- Need fidelity-first improvement with controlled verbosity.
