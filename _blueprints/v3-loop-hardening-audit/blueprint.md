# Blueprint: V3 Loop Hardening Audit

> Audit of the current live V3 Temporal loop after the core migration. The objective of this pass was to identify the remaining runtime/control-plane weaknesses before the next clean reset, patch the smallest high-leverage issues, and update campaign memory without relaunching the cohort.

---

## 0. Run Metadata

- **Run Folder:** `/Users/jesselee/dev/research/jg/judge-gym/_blueprints/v3-loop-hardening-audit`
- **Research Question:** What is the current health of the live V3 loop, what failures are still credible before the next reset, and what repo-side hardening should land now without wiping or relaunching the cohort?
- **Scope:** live V3 loop audit, batch/apply path, projection/control path, cohort status path, campaign bookkeeping
- **Constraint:** patch and document only; do not wipe or relaunch in this pass

---

## 1. Executive Read

The live V3 cohort is not dead. At audit time it was `healthy_progressing`, with all `18` runs active, no stuck items, and work concentrated in `score_gen` / `score_critic`. The real problems were behind the scenes:

1. **Batch-backed score stages were too brittle after provider completion.**
   Completed OpenAI batches could still fail to become persisted artifacts because stage activities had no retry cushion and the batch file-download path had no transport retry budget.

2. **Projection timeout pressure was causing misleading control/observability behavior.**
   `projectProcessState` had too little time budget for score-stage load, producing late-completion warnings and stale mirrors.

3. **V3 campaign status was still too broad.**
   The snapshot path still depended on larger-than-necessary experiment/run reads and could time out under full-loop load.

The correct next action was not another reset. It was a hardening patch set plus campaign-state/bookkeeping updates.

---

## 2. Evidence Ledger

- `k_001` — live cohort snapshot: 18 running, queues healthy, no current stuck items, work concentrated in score stages
- `k_002` — batch/apply audit: provider-complete batches could outrun persisted scores because stage retries and transport retries were insufficient
- `k_003` — projection/control audit: separate projection activity timed out too aggressively and run projection was missing some control-state fidelity
- `k_004` — campaign status audit: V3 snapshot still did broader-than-needed reads instead of staying scoped to explicit cohort tags and latest-run observability

---

## 3. What should be patched now

### S1. Add bounded retries where the live loop actually needs them

- Stage activities should not be hardcoded single-attempt when the fragile part is downstream of provider completion.
- Batch/file polling must have explicit transport retries.
- Keep projection retries single-attempt to avoid duplicate projection churn.

### S2. Separate projection timeout budget from stage timeout budget

- Projection work is smaller than a stage but still can exceed a short timeout during load.
- It needs a larger dedicated budget, not stage-wide retries.

### S3. Keep V3 status cohort-scoped

- Use the explicit manifest tag set, not global prefix scans.
- Use `process_observability` for latest-run freshness instead of broad stuck-work scans.
- Parallelize readiness + status aggregation.

### S4. Update campaign memory before any next reset

- Record this pass as a hardening audit iteration.
- Mark projection freshness as mitigated, not magically solved forever.
- Keep one observability item open for chunk-level batch reconciliation visibility.

---

## 4. Remaining open risk after this pass

The biggest remaining risk is not generic worker failure. It is **batch reconciliation visibility**:

- when completed provider batches lag persisted scores,
- the agent still lacks a compact chunk-level view that answers whether the system is:
  - still polling,
  - downloading output files,
  - applying results,
  - or stranded after provider completion.

That should be the next observability improvement if the next clean reset still shows score/apply lag.

---

## 5. Verification criteria

This pass is complete when:

1. `bun run validate:convex` passes
2. `bun run typecheck` passes
3. `cd apps/engine-temporal && bun run test` passes
4. campaign files reflect the live audit state
5. no reset or relaunch occurred during the pass

---

## 6. Next action

After this audit and patch set is committed, the next operational move should be:

1. redeploy the Railway worker onto the new code,
2. optionally let the live loop continue briefly if desired,
3. then do the next clean reset/start with the hardened retry/projection/status path.
