# Closure Recommendation

## Decision

Do **not** close the campaign after `R01`.

## Why

`R01` successfully converted the workspace into a candidate final matrix shape, but it did not fully eliminate the last matrix-blocking decisions:

1. the exact `Ziems` subset rule is still not locked
2. the OpenRouter lane is still policy-ambiguous between:
   - one supported provider-surface control
   - or a broader wave-1 multi-model slice
3. the conditional extension table still needs target-by-target locking

## Recommendation

Open `R02` as a bounded decision run with one job:

- convert the candidate matrix into a **fully locked matrix policy**

That run should:

- write the `Ziems` subset rule,
- decide the OpenRouter breadth policy,
- and emit the target-specific perturbation applicability table.

If `R02` succeeds, `R03` should be a short packaging run only. If `R02` collapses the packaging work into the same output, `R03` can be skipped.
