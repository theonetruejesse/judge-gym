# LGTM Protocol Pipeline and Execution Phases

**Confidence:** 0.92

**Sources:**

- .prompts/lgtm-protocol.md (lines 301-781)
- diagrams/lgtm-diagram.md (lines 1-84)

**Summary:**

The LGTM protocol executes through six distinct phases in a structured pipeline: (1) Initialization with evidence gathering and area decomposition, (2) Hypothesis Refinement Loop with iterative micro-hypothesis refinement, (3) Parallel Null Hypothesis Challenge with falsification testing, (4) Synthesis Pipeline integrating validated hypotheses, (5) Meta-Planning Phase generating optimized implementation pipeline, and (6) Final Plan Generation creating the comprehensive implementation document.

---

**Phase Breakdown:**

1. **Initialization:** Evidence gathering via AgentStep and UseTool, processing into standardized k\_\*.md files, decomposing into Areas of Analysis, generating initial micro-hypotheses

2. **Refinement Loop:** Iteratively refines micro-hypotheses using Critique and AgentStep primitives, identifies conflicts, continues until convergence criteria met

3. **Null Challenge:** Parallel falsification testing of candidate hypotheses, generates falsification queries, searches for disproving evidence, documents outcomes in nc\_\*.json files

4. **Synthesis:** Integrates validated hypotheses into coherent narrative and implementation prerequisites

5. **Meta-Planning:** Generates and optimizes implementation pipeline using Plan primitive

6. **Final Plan Generation:** Executes optimized pipeline, generates relevant diagrams, assembles final plan*synth*\*\_final.md document

