# Baseline Window Prompts (L1/L2/L3)

**Confidence:** 0.95

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/domain/window/evidence_prompts.ts

**Summary:**
Current prompts are stage-specific: L1 cleans boilerplate without paraphrase, L2 rewrites into a clinical factual summary prefixed with `Neutralized Summary:`, and L3 anonymizes entities/locations with role/type substitutions prefixed with `Abstracted Summary:`. In observed W1 outputs, L1 behavior is intentionally variable in compression, while L2/L3 sometimes over-expand and retain excess methodological detail.

## L1 Cleaning Instructions
- Remove nav/footer/share/recommendation boilerplate.
- Keep headline and article body.
- Do not summarize/paraphrase.

## L2 Neutralization Instructions
- Preserve factual claims/stats/sources.
- Remove emotional/editorial language.
- Keep as much content as possible.
- Prefix required: `Neutralized Summary:`.

## L3 Structural Abstraction Instructions
- Replace names/places/orgs with role/type descriptors.
- Preserve event relations and policy actions.
- Do not summarize/paraphrase.
- Prefix required: `Abstracted Summary:`.
