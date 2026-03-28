# V4 Native GPT-4.1

## Scope

This pass is the first native V4 conceptual-study slice, separate from the literature-audit spine.

- provider: `gpt-4.1`
- concepts: `fascism`, `illiberal_democracy`
- evidence universe: shared Media Cloud-backed universe
- curated evidence set: `48` items
- conditions:
  - `baseline_source`
  - `abstention_source`
  - `view_l2_neutralized`

That yields `6` completed experiments and `288` total scored responses.

## Why This Slice Exists

The paper-audit lane (`Gilardi`, `Zheng`) checks portability into existing literature. This native lane checks whether the V3 design-space story still appears on the new V4 substrate built around:

- evidence universes
- evidence sets
- source records
- semantic views
- provider-aware execution

So the question here is not paper fidelity. It is whether the native conceptual regime still shows strong movement under concept framing, abstention, and semantic evidence transforms.

## Main Findings

### Abstention Is Real Again In The Native Lane

Unlike the literature-audit headline matrix, abstention is active here.

- `fascism` baseline -> abstention:
  - abstain delta: `+0.167`
  - flip rate: `0.771`
  - geometry flip rate: `0.667`
- `illiberal_democracy` baseline -> abstention:
  - abstain delta: `+0.125`
  - flip rate: `0.500`
  - geometry flip rate: `0.333`

So the weak abstention story from the paper-audit lane should not be generalized. On the native conceptual evidence set, abstention materially changes the regime, especially for `fascism`.

### Concept Framing Still Moves The Instrument Hard

On the exact same evidence set, changing the concept still changes outcomes materially.

- baseline `fascism` vs `illiberal_democracy`:
  - flip rate: `0.521`
  - geometry flip rate: `0.312`
- abstention `fascism` vs `illiberal_democracy`:
  - flip rate: `0.771`
  - geometry flip rate: `0.562`
- `l2` `fascism` vs `illiberal_democracy`:
  - flip rate: `0.562`
  - geometry flip rate: `0.208`

That is a strong continuity result with the V3 thesis: concept selection is still one of the dominant regime levers.

### `l2_neutralized` Is Directional, Not Uniform

The same semantic transform does not have the same effect on both concepts.

- `fascism` source -> `l2`:
  - flip rate: `0.604`
  - expected-stage delta: `-0.219`
  - mean subset-size delta: `-0.062`
  - singleton-rate delta: `+0.104`
- `illiberal_democracy` source -> `l2`:
  - flip rate: `0.375`
  - expected-stage delta: `+0.062`
  - mean subset-size delta: `+0.104`
  - singleton-rate delta: `-0.104`

So `l2_neutralized` is not just “noise reduction.” It pushes the regime in different directions depending on the concept being judged.

### Fascism Is The More Sensitive Regime

`fascism` is clearly less stable than `illiberal_democracy` in this slice.

- baseline singleton rate:
  - `fascism`: `0.750`
  - `illiberal_democracy`: `0.896`
- abstention singleton rate:
  - `fascism`: `0.400`
  - `illiberal_democracy`: `0.833`
- baseline mean subset size:
  - `fascism`: `1.250`
  - `illiberal_democracy`: `1.208`
- abstention mean subset size:
  - `fascism`: `1.700`
  - `illiberal_democracy`: `1.167`

The clearest reading is that `fascism` is the broader, more fragile adjudicative regime on this evidence set, while `illiberal_democracy` behaves more like a narrower and more stable coding frame.

## Interpretation

This is the strongest native-V4 continuity result so far.

- The V4 substrate can reproduce nontrivial design-space movement.
- Abstention remains important, but only in the settings where the task genuinely supports it.
- Concept framing remains one of the major levers on contested political evidence.
- Semantic transforms should be treated as regime interventions, not neutral preprocessing.

That means the current plan is still right:

- keep the paper-audit lane separate
- use GPT-4.1 as the scale-up anchor first
- promote only the native cells with strong movement to `gpt-5.2` and then selective non-OpenAI runs

## Recommended Next Step

Use this native GPT-4.1 slice as the gating screen for promotion:

- promote `fascism baseline`, `fascism abstention`, and `fascism l2`
- promote `illiberal_democracy baseline` and `illiberal_democracy l2`
- treat `illiberal_democracy abstention` as lower priority unless budget allows

The operational analysis artifacts live under:

- `apps/analysis/_outputs/v4/native_gpt41/report.md`
- `apps/analysis/_outputs/v4/native_gpt41/summary.json`
- `apps/analysis/_outputs/v4/native_gpt41/contrast_metrics.csv`
