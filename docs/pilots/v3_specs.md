# V3 Specs (L2-First, Live Finish Pass)

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
7. RQ7: Does the Norway election-reporting control pool stay low-signal under baseline settings?
   - Check: run required P3 checks under baseline settings.
8. RQ8: Does bundle-context aggregation materially shift geometry relative to single-evidence scoring?
   - Check: compare matched `single_evidence` vs `bundle` runs on `P1` with stratified-by-window bundles.

## Windows

| Window ID | Pool | Date Range               | Build Procedure                                                                |           Output |
| :-------- | :--- | :----------------------- | :----------------------------------------------------------------------------- | ---------------: |
| W1-W10    | P1   | 2026-01-01 to 2026-01-07 | one query per window; fetch 10; keep 2                                         | 2 each (20 total) |
| W12-W15   | P3   | 2025-09-08 to 2025-09-12 | Norway election-reporting queries; fetch 10 per window; dedupe aggressively    | 4 final keepers |

### W1-W10 query plan (P1)

| Window | Country       | Query                                                         |
| :----- | :------------ | ------------------------------------------------------------- |
| W1     | United States | election certification disputes United States                 |
| W2     | United States | court rulings executive authority United States               |
| W3     | United States | independence of judiciary United States                       |
| W4     | United States | civil liberties protest restrictions United States            |
| W5     | United States | press freedom media intimidation United States                |
| W6     | United States | emergency powers executive branch United States               |
| W7     | United States | legislature executive conflict shutdown United States         |
| W8     | United States | political violence threats candidates United States           |
| W9     | United States | immigration enforcement due process United States             |
| W10    | United States | foreign policy military authorization oversight United States |

### W12-W15 control window plan (P3)

| Window | Country | Query                                                  |
| :----- | :------ | :----------------------------------------------------- |
| W12    | Norway  | Norway parliamentary election results reporting        |
| W13    | Norway  | Norway election turnout count official reporting       |
| W14    | Norway  | Norway election authorities official results reporting |
| W15    | Norway  | Norway election reporting Storting seats results       |

## Pools

| Pool ID | Source                                          | Purpose                           | Size | Done |
| :------ | :---------------------------------------------- | :-------------------------------- | ---: | :--- |
| P1      | W1-W10 (real news)                              | Primary contested pool            |   20 | true |
| P3      | W12-W15 Norway election-reporting control trial | Low-contestation reporting control |    4 | true |

## Experiments (Source of Truth)

| Tier                                    | Pool | Models                     | Concept                | Ablations                                                                                              | Config Count | Done |
| :-------------------------------------- | :--- | :------------------------- | :--------------------- | :----------------------------------------------------------------------------------------------------- | -----------: | :--- |
| A1 (primary baseline + abstain)         | P1   | gpt-4.1, gpt-5.2           | fascism                | abstain (2), semantic=`l2`, scale=`4`, `evidence_grouping=single_evidence`                            |            4 | false |
| A2 (primary semantic ablation)          | P1   | gpt-4.1, gpt-5.2           | fascism                | semantic=`l3`, abstain=`true`, scale=`4`, `evidence_grouping=single_evidence`                         |            2 | false |
| A3 (primary scale ablation)             | P1   | gpt-4.1, gpt-5.2           | fascism                | scale=`5`, semantic=`l2`, abstain=`true`, `evidence_grouping=single_evidence`                         |            2 | false |
| A4 (primary swap mechanism)             | P1   | gpt-4.1 ↔ gpt-5.2          | fascism                | rubric/scoring swap, semantic=`l2`, scale=`4`, abstain=`true`, `evidence_grouping=single_evidence`   |            2 | false |
| A5 (concept extension baseline)         | P1   | gpt-4.1, gpt-5.2           | illiberal democracy    | abstain=`true`, semantic=`l2`, scale=`4`, `evidence_grouping=single_evidence`                         |            2 | false |
| A6 (bundle-context ablation)            | P1   | gpt-4.1, gpt-5.2           | fascism                | semantic=`l2`, scale=`4`, abstain=`true`, `evidence_grouping=bundle`, stratified-by-window bundles    |            2 | false |
| B1 (secondary baseline + abstain)       | P1   | gpt-4.1-mini, gpt-5.2-chat | fascism                | abstain (2), semantic=`l2`, scale=`4`, `evidence_grouping=single_evidence`                            |            4 | false |
| D1 (Norway reporting control baseline)  | P3   | gpt-4.1, gpt-5.2           | fascism (control pool) | abstain=`true`, semantic=`l2`, scale=`4`, `evidence_grouping=single_evidence`                         |            2 | false |

Required total (current live finish pass): **20 configs**.

### Bundle Ablation Notes

- `A6` uses the current frozen `P1` pool and the new explicit `scoring_config.evidence_grouping` path.
- Bundle membership is assigned **per run**, frozen at run creation, and inspectable via `packages/lab:listRunScoreTargets`.
- Current canary coverage already passed for:
  - `bundle_size=3`
  - `bundle_size=5`
  - `bundle_size="all"`
- Current default bundle settings for the first real pass:
  - `mode="bundle"`
  - `bundle_size=5`
  - `bundle_strategy="stratified_by_window"`
  - `assignment_scope="per_run"`
  - each sample partitions the frozen pool into multiple bundle score targets; `bundle_size=5` on `P1` yields `4` score targets per sample

### Preflight

- [ ] Confirm index hardening is deployed (`llm_requests.by_run`, artifact `by_run`, transport `by_custom_key_status`).
- [x] Reset run/LLM operational tables before fresh validation (keep windows/evidence).
- [ ] Confirm `P1` has expected count (20 evidence; 2 per W1-W10).
- [ ] Confirm `P3` is populated with expected count (`4` de-duplicated Norway reporting items).
- [ ] Confirm P1/P3 dedupe pass is complete (normalized URL + near-duplicate title).
- [ ] Confirm pool freeze metadata is recorded (stable `pool_tag` + fixed evidence IDs).
- [ ] Confirm default experiment settings (subset scoring + all randomizations + explicit `evidence_grouping`).
- [ ] Run final tiny canary gate:
  - one `single_evidence` baseline (`target_count=1`)
  - one `bundle` baseline (`target_count=1`)

### Pool QA Gate (must pass before required runs)

- [ ] `P1` cardinality invariant passes (`10 × 2 = 20`).
- [ ] `P3` cardinality invariant passes (`4` de-duplicated election-reporting items).
- [ ] All selected P1/P3 evidence has non-empty `l2_neutralized_content`.
- [ ] `P3` selected evidence passes exclusion rules (no crisis/overturn/authoritarian framing artifacts).

### Required Runs

- [ ] Complete A1 (4 configs): primary baseline + abstain check (`l2`, scale `4`).
- [ ] Complete A2 (2 configs): singular `l3` semantic ablation (`abstain=true`, scale `4`).
- [ ] Complete A3 (2 configs): singular scale `5` ablation (`l2`, `abstain=true`).
- [ ] Complete A4 (2 configs): primary rubric/scoring swap mechanism check.
- [ ] Complete A5 (2 configs): `illiberal democracy` concept extension baseline.
- [ ] Complete A6 (2 configs): bundle-context ablation on `P1`.
- [ ] Complete B1 (4 configs): secondary-model baseline + abstain check (`gpt-4.1-mini`, `gpt-5.2-chat`).
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
