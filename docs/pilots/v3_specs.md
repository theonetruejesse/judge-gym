# V3 Specs (L2-First, Full Required Matrix)

## Objective and Guardrails

- Objective: characterize adjudicative geometry differences across selected GPT models under controlled, minimal-but-complete ablations.
- Claim policy: descriptive first; no strong causal claims unless ablation thresholds are met.
- Fixed defaults:
  - `method=subset`
  - all randomizations on (`anonymize_stages`, `shuffle_rubric_order`, `hide_label_text`)
  - `target_count=30`
  - default semantic/scoring context is `l2`
  - default `scale_size=4`

## Research Questions (with decision checks)

1. RQ1: Does compression-like geometry reproduce for GPT-5.2 vs GPT-4.1 under baseline settings?
   - Check: low mid-range occupancy + higher stage-1/abstain concentration relative to GPT-4.1 on matched pool/settings (`l2`, scale `4`).
2. RQ2: How much does abstain policy change observed geometry?
   - Check: compare `abstain_enabled=true/false` on matched settings (`l2`, scale `4`).
3. RQ3: Does semantic normalization level matter at this stage?
   - Check: treat `l3` as a singular ablation against `l2` (hold model/scale/abstain fixed).
4. RQ4: Is midpoint availability material for this setup?
   - Check: single scale ablation `4` vs `5` (hold model/semantic/abstain fixed).
5. RQ5: How much is rubric mechanism vs scoring-model mechanism?
   - Check: run primary-model rubric/scoring swap on baseline settings and compare geometry persistence.
6. RQ6: Do secondary-model patterns cohere with primary-model findings?
   - Check: run baseline + abstain check on `gpt-4.1-mini` and `gpt-5.2-chat`.
7. RQ7: Do synthetic/control pools show expected grounding behavior?
   - Check: run required P2 and P3 checks under baseline settings.

## Windows

| Window ID | Pool | Date Range               | Build Procedure                        |            Output |
| :-------- | :--- | :----------------------- | :------------------------------------- | ----------------: |
| W1-W10    | P1   | 2026-01-01 to 2026-01-07 | one query per window; fetch 10; keep 2 | 2 each (20 total) |
| W11       | P2   | N/A                      | synthetic ladder scenarios (S1..S10)   |                10 |
| W12-W15   | P3   | 2026-01-01 to 2026-01-07 | one Norway-only control query per window; fetch 10; keep 5 | 5 each (20 total) |

### W1-W10 query plan (P1)

| Window | Query                                                         |
| :----- | :------------------------------------------------------------ |
| W1     | election certification disputes United States                 |
| W2     | court rulings executive authority United States               |
| W3     | independence of judiciary United States                       |
| W4     | civil liberties protest restrictions United States            |
| W5     | press freedom media intimidation United States                |
| W6     | emergency powers executive branch United States               |
| W7     | legislature executive conflict shutdown United States         |
| W8     | political violence threats candidates United States           |
| W9     | immigration enforcement due process United States             |
| W10    | foreign policy military authorization oversight United States |

### W12-W15 control window plan (P3)

| Window | Country  | Query |
| :----- | :------- | :---- |
| W12    | Norway   | election administration OR electoral authority OR voting procedure updates |
| W13    | Norway   | parliamentary committee procedure OR legislative process OR bill procedure |
| W14    | Norway   | court procedural ruling OR statutory interpretation OR appeals procedure |
| W15    | Norway   | executive agency policy implementation OR ministry guidance OR civil service operations |

## Pools

| Pool ID | Source                                                     | Purpose                           | Size |
| :------ | :--------------------------------------------------------- | :-------------------------------- | ---: |
| P1      | W1-W10 (real news)                                         | Primary contested pool            |   20 |
| P2      | W11 synthetic ladder (S1..S10)                             | Required grounding check pool     |   10 |
| P3      | W12-W15 low-contestation control (Norway-only windows) | Required low-contestation control |   20 |

## Pool Construction SOP (Source of Truth)

### Canonical workflow (all pools)

1. Create the planned window.
2. Fetch candidates with `evidence_limit=10`.
3. Rank by:
   - concept relevance to the intended pool purpose,
   - institutional observability (actions, policies, institutional responses),
   - text completeness (sufficient article body for scoring).
4. De-duplicate by normalized URL and near-duplicate title.
5. Keep fixed cardinality for that window.
6. Create pool from selected evidence IDs and freeze membership:
   - set stable `pool_tag`,
   - do not swap evidence after first experiment is initialized from the pool.

### P1 SOP (20 total)

- Inputs: W1-W10 query plan above.
- Keep rule: exactly 2 evidence items per window after ranking and dedupe.
- Exclude: duplicates, pure opinion/editorials, and non-governance tangents.
- Invariant: `10 windows × 2 = 20` evidence rows in P1.

### P3 SOP (20 total)

- Inputs: W12-W15 Norway-only control windows above.
- Keep rule: exactly 5 evidence items per window after ranking and dedupe.
- Include: routine democratic process coverage (election admin, normal legislative procedure, ordinary judicial process, standard policy implementation).
- Exclude: election-overturn attempts, emergency-rule expansion, coup/insurrection framing, systematic rights suppression, explicit fascism/authoritarian labeling.
- Invariant: `4 windows × 5 = 20` evidence rows in P3.

## Experiments (Source of Truth)

| Tier                              | Pool | Models                     | Concept                  | Ablations                                                     | Config Count |
| :-------------------------------- | :--- | :------------------------- | :----------------------- | :------------------------------------------------------------ | -----------: |
| A1 (primary baseline + abstain)   | P1   | gpt-4.1, gpt-5.2           | fascism                  | abstain (2), semantic=`l2`, scale=`4`                         |            4 |
| A2 (primary semantic ablation)    | P1   | gpt-4.1, gpt-5.2           | fascism                  | semantic=`l3`, abstain=`true`, scale=`4`                      |            2 |
| A3 (primary scale ablation)       | P1   | gpt-4.1, gpt-5.2           | fascism                  | scale=`5`, semantic=`l2`, abstain=`true`                      |            2 |
| A4 (primary swap mechanism)       | P1   | gpt-4.1 ↔ gpt-5.2          | fascism                  | rubric/scoring swap, semantic=`l2`, scale=`4`, abstain=`true` |            2 |
| B1 (secondary baseline + abstain) | P1   | gpt-4.1-mini, gpt-5.2-chat | fascism                  | abstain (2), semantic=`l2`, scale=`4`                         |            4 |
| C1 (synthetic grounding check)    | P2   | gpt-4.1, gpt-5.2           | synthetic ladder         | abstain=`true`, semantic=`l2`, scale=`4`                      |            2 |
| D1 (control domain check)         | P3   | gpt-4.1, gpt-5.2           | fascism (control pool)   | abstain=`true`, semantic=`l2`, scale=`4`                      |            2 |

Required total: **18 configs**.

## Model Use Semantics (Source of Truth)

- Primary models: `gpt-4.1`, `gpt-5.2`.
  - Required tiers: `A1`, `A2`, `A3`, `A4`, `C1`, `D1`.
- Secondary models: `gpt-4.1-mini`, `gpt-5.2-chat`.
  - Required tier: `B1` only.
- Pool-to-tier mapping:
  - `P1` feeds `A1/A2/A3/A4/B1`.
  - `P2` feeds `C1`.
  - `P3` feeds `D1`.

## API Request Breakdown

Assumptions per config (`target_count=30`):

- `rubric_gen = 30`
- `rubric_critic = 30`
- `score_gen = 30 × pool_size`
- `score_critic = 30 × pool_size`

Per-config totals:

- Pool size `20` (`P1`, `P3`): `1260`
- Pool size `10` (`P2`): `660`

### Required plan (18 configs)

| Tier           | Configs | Pool Size | Rubric Gen | Rubric Critic | Score Gen | Score Critic |     Total |
| :------------- | ------: | --------: | ---------: | ------------: | --------: | -----------: | --------: |
| A1             |       4 |        20 |        120 |           120 |      2400 |         2400 |      5040 |
| A2             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| A3             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| A4             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| B1             |       4 |        20 |        120 |           120 |      2400 |         2400 |      5040 |
| C1             |       2 |        10 |         60 |            60 |       600 |          600 |      1320 |
| D1             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| **Plan Total** |  **18** |           |    **540** |       **540** | **10200** |    **10200** | **21480** |

### Plan totals

- Total requests: **21480**
- Stage totals:
  - `rubric_gen`: **540**
  - `rubric_critic`: **540**
  - `score_gen`: **10200**
  - `score_critic`: **10200**

## Execution Checklist (Source of Truth TODO)

### Preflight

- [ ] Confirm index hardening is deployed (`llm_requests.by_run`, artifact `by_run`, transport `by_custom_key_status`).
- [ ] Reset run/LLM operational tables before fresh validation (keep windows/evidence).
- [ ] Confirm `P1` has expected count (20 evidence; 2 per W1-W10).
- [ ] Confirm `P2` and `P3` are populated with expected counts.
- [ ] Confirm P1/P3 dedupe pass is complete (normalized URL + near-duplicate title).
- [ ] Confirm pool freeze metadata is recorded (stable `pool_tag` + fixed evidence IDs).
- [ ] Confirm default experiment settings (subset scoring + all randomizations).
- [ ] Run one tiny canary (`target_count=1`) and verify full stage completion.

### Pool QA Gate (must pass before required runs)

- [ ] `P1` cardinality invariant passes (`10 × 2 = 20`).
- [ ] `P3` cardinality invariant passes (`4 × 5 = 20`).
- [ ] All selected P1/P3 evidence has non-empty `l2_neutralized_content`.
- [ ] `P3` selected evidence passes exclusion rules (no crisis/overturn/authoritarian framing artifacts).

### Required Runs

- [ ] Complete A1 (4 configs): primary baseline + abstain check (`l2`, scale `4`).
- [ ] Complete A2 (2 configs): singular `l3` semantic ablation (`abstain=true`, scale `4`).
- [ ] Complete A3 (2 configs): singular scale `5` ablation (`l2`, `abstain=true`).
- [ ] Complete A4 (2 configs): primary rubric/scoring swap mechanism check.
- [ ] Complete B1 (4 configs): secondary-model baseline + abstain check (`gpt-4.1-mini`, `gpt-5.2-chat`).
- [ ] Complete C1 (2 configs): synthetic grounding check on P2.
- [ ] Complete D1 (2 configs): fascism-control check on P3.

### Per-run Monitoring

- [ ] Capture expected vs observed stage target counts.
- [ ] Capture retry distribution by class (parse/apply/provider/rate-limit).
- [ ] Capture time-to-stage-finalization.
- [ ] Capture stuck-work snapshots and any heal actions.
- [ ] Store final status summary (success/error counts).

### Hard Stop Conditions

- [ ] Stop if scheduler ticks show no net progress for 3 intervals.
- [ ] Stop if retries hit caps unexpectedly across broad cohorts.
- [ ] Stop if telemetry growth diverges from expected request volume.
- [ ] Stop if stuck work persists after dry-run + apply safe-heal cycle.

### Recovery Protocol

- [ ] `debug:stuck`
- [ ] `debug:heal` (dry-run)
- [ ] `debug:heal --apply` (if safe actions are suggested)
- [ ] Re-check with `debug:watch` + `debug:analyze`

## Deferred Scope (Intentionally Out of Current V3)

- `scale_size=7` full-factorial sweep
- concept extension (`illiberal democracy`) as primary tier
