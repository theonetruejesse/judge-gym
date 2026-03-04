# V3 Specs (Reference)

## Objective and Guardrails

- Objective: characterize adjudicative geometry differences across selected GPT models under controlled ablations.
- Claim policy: descriptive first; no strong causal claims unless ablation thresholds are met.
- Fixed defaults: subset scoring, randomizations fixed to default set, `target_count=30`.

## Research Questions (with decision checks)

1. RQ1: Does compression-like geometry reproduce for GPT-5.2 vs GPT-4.1?
   - Check: low mid-range occupancy + higher stage-1/abstain concentration relative to GPT-4.1 on matched pool/settings.
2. RQ2: How much is rubric mechanism vs model mechanism?
   - Check: if divergence persists after rubric swap, favor model-attached explanation.
3. RQ3: Is forced-choice inflating disagreement?
   - Check: compare `abstain_enabled=true/false` holding other settings fixed.
4. RQ4: How sensitive is geometry to semantic level and scale?
   - Check: compare `l2` vs `l3`, and `scale_size=4` vs `7` for material shifts.

## Windows

| Window ID | Pool | Date Range               | Build Procedure                        |            Output |
| :-------- | :--- | :----------------------- | :------------------------------------- | ----------------: |
| W1-W10    | P1   | 2026-01-01 to 2026-01-07 | one query per window; fetch 10; keep 2 | 2 each (20 total) |
| W11       | P2   | N/A                      | synthetic ladder scenarios (S1..S10)   |                10 |
| W12       | P3   | TBD                      | low-contestation control collection    |                20 |

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

## Pools

| Pool ID | Source                                                | Purpose                                     | Size |
| :------ | :---------------------------------------------------- | :------------------------------------------ | ---: |
| P1      | W1-W10 (real news)                                    | Primary pilot pool (required)               |   20 |
| P2      | W11 synthetic ladder (S1..S10)                        | Grounding/calibration sidecar (recommended) |   10 |
| P3      | W12 low-contestation control (e.g., Norway democracy) | Post-core control (optional)                |   20 |

## Experiments

| Tier                                | Pool | Models                     | Concepts                 | Ablations                                            | Config Count |
| :---------------------------------- | :--- | :------------------------- | :----------------------- | :--------------------------------------------------- | -----------: |
| A1 (primary full)                   | P1   | gpt-4.1, gpt-5.2           | fascism                  | abstain (2) × semantic (`l2`,`l3`) × scale (`4`,`7`) |           16 |
| A2 (primary check)                  | P1   | gpt-4.1, gpt-5.2           | illiberal democracy      | abstain (2), semantic=`l3`, scale=`7`                |            4 |
| B (secondary sanity)                | P1   | gpt-4.1-mini, gpt-5.2-chat | fascism                  | abstain (2), semantic=`l3`, scale=`7`                |            4 |
| Swap (default)                      | P1   | gpt-4.1 ↔ gpt-5.2          | fascism                  | abstain (2), semantic=`l3`, scale=`7`                |            4 |
| Synthetic check (optional, minimal) | P2   | gpt-4.1, gpt-5.2           | synthetic ladder         | abstain (2), semantic=`l3`, scale=`7`                |            4 |
| Control check (optional)            | P3   | gpt-4.1, gpt-5.2           | low-contestation control | abstain (2), semantic=`l3`, scale=`7`                |            4 |

Required baseline total: **28 configs**.
Optional add-ons: **+4** (synthetic minimal), **+4** (control).
Max with both add-ons: **36 configs**.

## API Request Breakdown

Assumptions per config (`target_count=30`):
- `rubric_gen = 30`
- `rubric_critic = 30`
- `score_gen = 30 × pool_size`
- `score_critic = 30 × pool_size`

Per-config totals:
- Pool size `20` (`P1`, `P3`): `1260`
- Pool size `10` (`P2`): `660`

### Required baseline (28 configs)

| Tier | Configs | Pool Size | Rubric Gen | Rubric Critic | Score Gen | Score Critic | Total |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| A1 | 16 | 20 | 480 | 480 | 9600 | 9600 | 20160 |
| A2 | 4 | 20 | 120 | 120 | 2400 | 2400 | 5040 |
| B | 4 | 20 | 120 | 120 | 2400 | 2400 | 5040 |
| Swap | 4 | 20 | 120 | 120 | 2400 | 2400 | 5040 |
| **Baseline Total** | **28** |  | **840** | **840** | **16800** | **16800** | **35280** |

### Optional add-ons

| Tier | Configs | Pool Size | Rubric Gen | Rubric Critic | Score Gen | Score Critic | Total |
| :-- | --: | --: | --: | --: | --: | --: | --: |
| Synthetic check | 4 | 10 | 120 | 120 | 1200 | 1200 | 2640 |
| Control check | 4 | 20 | 120 | 120 | 2400 | 2400 | 5040 |
| **Optional Total** | **8** |  | **240** | **240** | **3600** | **3600** | **7680** |

### Max plan (36 configs)

- Total requests: **42960**
- Stage totals:
  - `rubric_gen`: **1080**
  - `rubric_critic`: **1080**
  - `score_gen`: **20400**
  - `score_critic`: **20400**

## Execution Checklist (Source of Truth TODO)

### Preflight

- [ ] Confirm windows `W1-W12` exist with expected counts.
- [ ] Confirm default experiment settings (subset scoring + default randomizations).
- [ ] Run one tiny canary (`target_count=1`) and verify full stage completion.

### Baseline Runs

- [ ] Complete Tier A1 (16 configs).
- [ ] Complete Tier A2 (4 configs).
- [ ] Complete Tier B (4 configs).
- [ ] Complete default Swap tier (4 configs).

### Optional Runs

- [ ] Run Synthetic check (4 configs, P2) if baseline interpretation remains ambiguous.
- [ ] Run Control check (4 configs, P3) for low-contestation comparison.

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

### Synthetic Grounding Checks (if P2 run)

- [ ] Monotonicity from `S1` to `S10`.
- [ ] Interior-stage utilization (especially on scale `7`).
- [ ] Abstain localization near ambiguous boundary cases.
- [ ] Cross-model divergence on synthetic should be lower than contested real-news runs.
