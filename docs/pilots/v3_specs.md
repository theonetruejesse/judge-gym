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

| Window ID | Pool | Date Range               | Build Procedure                                            |            Output |
| :-------- | :--- | :----------------------- | :--------------------------------------------------------- | ----------------: |
| W1-W10    | P1   | 2026-01-01 to 2026-01-07 | one query per window; fetch 10; keep 2                     | 2 each (20 total) |
| W11       | P2   | N/A                      | synthetic ladder scenarios (S1..S10)                       |                10 |
| W12-W15   | P3   | 2025-09-08 to 2025-09-12 | Norway election-reporting queries; fetch 10 per window; dedupe and keep 10 total |                10 |

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

### W12-W15 control window plan (P3 current pass)

| Window | Country | Query |
| :----- | :------ | :---- |
| W12    | Norway  | Norway parliamentary election results reporting |
| W13    | Norway  | Norway election turnout count official reporting |
| W14    | Norway  | Norway election authorities official results reporting |
| W15    | Norway  | Norway election reporting Storting seats results |

## Pools

| Pool ID | Source                                                 | Purpose                           | Size |
| :------ | :----------------------------------------------------- | :-------------------------------- | ---: |
| P1      | W1-W10 (real news)                                     | Primary contested pool            |   20 |
| P2      | W11 synthetic ladder (S1..S10)                         | Required grounding check pool     |   10 |
| P3      | W12-W15 Norway election-reporting control trial | Required low-contestation control |   10 |

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

### P3 SOP (10 total, current pass)

- Inputs: W12-W15 Norway election-reporting windows above.
- Keep rule: de-duplicate across all four windows and keep exactly `10` evidence items total.
- Include: routine election result reporting, turnout/count reporting, official results coverage, seat allocation, and coalition formation reporting immediately after the vote.
- Exclude: campaign-issue explainers, opinion/editorials, conflict-first framing not centered on results reporting, and items with explicit fascism/authoritarian labeling.
- Invariant: `10` de-duplicated evidence rows in P3.

### P3 Operational Build (Current Active Pool)

- Window model: `gpt-4.1-mini` for all four evidence windows.
- Date range: `2025-09-08` to `2025-09-12` for every P3 window.
- Country: `Norway` for every P3 window in the current pass.
- Evidence limit: `10` candidates per window.
- Active pool tag: `p3_norway_election_reporting_trial_2025_09_08`.
- Active pool id: `ms7df5bwnh74ydh5v6rqm1r36d82ge8a`.

#### Exact `createWindowForm` payloads

| Window | Payload |
| :----- | :------ |
| W12 | `{ evidence_window: { country: "Norway", model: "gpt-4.1-mini", start_date: "2025-09-08", end_date: "2025-09-12", query: "Norway parliamentary election results reporting" }, evidence_limit: 10 }` |
| W13 | `{ evidence_window: { country: "Norway", model: "gpt-4.1-mini", start_date: "2025-09-08", end_date: "2025-09-12", query: "Norway election turnout count official reporting" }, evidence_limit: 10 }` |
| W14 | `{ evidence_window: { country: "Norway", model: "gpt-4.1-mini", start_date: "2025-09-08", end_date: "2025-09-12", query: "Norway election authorities official results reporting" }, evidence_limit: 10 }` |
| W15 | `{ evidence_window: { country: "Norway", model: "gpt-4.1-mini", start_date: "2025-09-08", end_date: "2025-09-12", query: "Norway election reporting Storting seats results" }, evidence_limit: 10 }` |

#### P3 selection procedure

1. Create `W12`, `W13`, `W14`, and `W15` with the exact payloads above.
2. Wait until candidate evidence has non-empty `l2_neutralized_content` before final selection.
3. Review fetched candidates and apply hard exclusions first:
   - opinion/editorials,
   - pre-election issue explainers not centered on results reporting,
   - conflict-first campaign framing,
   - explicit authoritarian/fascism labeling,
   - low-body or incomplete articles.
4. De-duplicate by normalized URL and near-duplicate title across all four windows.
5. Prefer the cleanest election-night / official-results reporting pieces first, then keep the strongest `10` distinct items total.
6. Create `P3` from the resulting evidence IDs and freeze membership immediately under the active pool tag above.

#### P3 active freeze set

- Pool size: `10` evidence items.
- Pool composition: de-duplicated Norway parliamentary election reporting from September 8-9, 2025.
- Intended use: current `D1` control trial only.

## Experiments (Source of Truth)

| Tier                              | Pool | Models                     | Concept                | Ablations                                                     | Config Count | Done |
| :-------------------------------- | :--- | :------------------------- | :--------------------- | :------------------------------------------------------------ | -----------: | :--- |
| A1 (primary baseline + abstain)   | P1   | gpt-4.1, gpt-5.2           | fascism                | abstain (2), semantic=`l2`, scale=`4`                         |            4 | false |
| A2 (primary semantic ablation)    | P1   | gpt-4.1, gpt-5.2           | fascism                | semantic=`l3`, abstain=`true`, scale=`4`                      |            2 | false |
| A3 (primary scale ablation)       | P1   | gpt-4.1, gpt-5.2           | fascism                | scale=`5`, semantic=`l2`, abstain=`true`                      |            2 | false |
| A4 (primary swap mechanism)       | P1   | gpt-4.1 ↔ gpt-5.2          | fascism                | rubric/scoring swap, semantic=`l2`, scale=`4`, abstain=`true` |            2 | false |
| B1 (secondary baseline + abstain) | P1   | gpt-4.1-mini, gpt-5.2-chat | fascism                | abstain (2), semantic=`l2`, scale=`4`                         |            4 | false |
| C1 (synthetic grounding check)    | P2   | gpt-4.1, gpt-5.2           | synthetic ladder       | abstain=`true`, semantic=`l2`, scale=`4`                      |            2 | false |
| D1 (control domain check)         | P3   | gpt-4.1, gpt-5.2           | fascism (control pool) | abstain=`true`, semantic=`l2`, scale=`4`                      |            2 | true |

Required total: **18 configs**.

- `Done` means the tier has been initialized and started for the current pass, not that all runs have completed.
- Active `D1` experiment/run pairs:
  - `gpt-4.1`: experiment `j97bsj3ja09q5304x65t7xwkv982gbqr`, run `kh7avay0pw0jdc15svq9jpz5p182gwjw`.
  - `gpt-5.2`: experiment `j97ep0yj8sme9pg5mryq9kw2v982g2xj`, run `kh77e0h2fp5pmr9geaf5q9myh982gecn`.

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

- Pool size `20` (`P1`): `1260`
- Pool size `10` (`P2`, `P3` current pass): `660`

### Required plan (18 configs)

| Tier           | Configs | Pool Size | Rubric Gen | Rubric Critic | Score Gen | Score Critic |     Total |
| :------------- | ------: | --------: | ---------: | ------------: | --------: | -----------: | --------: |
| A1             |       4 |        20 |        120 |           120 |      2400 |         2400 |      5040 |
| A2             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| A3             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| A4             |       2 |        20 |         60 |            60 |      1200 |         1200 |      2520 |
| B1             |       4 |        20 |        120 |           120 |      2400 |         2400 |      5040 |
| C1             |       2 |        10 |         60 |            60 |       600 |          600 |      1320 |
| D1             |       2 |        10 |         60 |            60 |       600 |          600 |      1320 |
| **Plan Total** |  **18** |           |    **540** |       **540** |  **9600** |     **9600** | **20280** |

### Plan totals

- Total requests: **20280**
- Stage totals:
  - `rubric_gen`: **540**
  - `rubric_critic`: **540**
  - `score_gen`: **9600**
  - `score_critic`: **9600**

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
- [ ] `P3` cardinality invariant passes (`10` de-duplicated election-reporting items).
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
