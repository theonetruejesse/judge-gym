# Experiment Shortfalls by Model

**Confidence:** 0.93

**Sources:**
- Convex MCP `packages/lab:listExperiments`, 2026-03-09
- Convex MCP one-off readonly query on dev deployment, 2026-03-09 (latest-run shortfall grouped by scoring model)

**Summary:**
The current incomplete experiment ledger clusters strongly by model. The audited experiment table showed shortfalls grouped as: `gpt-5.2-chat` with `2` experiments and `60` missing samples, `gpt-4.1-mini` with `2` experiments and `8` missing samples, `gpt-4.1` with `4` experiments and `8` missing samples, and `gpt-5.2` with `1` experiment and `1` missing sample. This makes `gpt-5.2-chat` the dominant model-specific hotspot by a wide margin.

This evidence matters because it narrows the primary rerun-risk surface. The next rebuild should assume that `gpt-5.2-chat` subset score generation is the highest-probability parse-risk lane until the prompt/parser contract and parse-failure observability are fixed.
