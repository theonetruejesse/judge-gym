# N01 Export Candidate Map

## Export Signal

The thread export converges on a small, non-systematic shortlist rather than a broad review. The recurring instruction is to pick a few papers that can be reconstructed fairly, audited with `judge-gym`, and used to show that evaluator-regime sensitivity matters outside the bespoke fascism setting.

The strongest shortlist signals appear in these messages from the export:

- `2b45bc28-0f5d-4682-8681-072f4edea0b5`: triage after the Consensus mining pass. This message separates flagship audit targets from support literature and explicitly elevates `Törnberg`, `Ziems`, `Gilardi`, and selected judge-bias papers.
- `82955f0d-f227-4202-bda4-29a0f2b3d15c`: V4 handoff artifact. This fixes the V4 two-track structure and lists likely examples to investigate: `Törnberg`, `Ziems`, `Stureborg`, `Wei`, `Gilardi`, and one clean comparator.

## Recovered Candidate Set

### Direct audit targets discussed in the export

- `Gilardi et al.`: human-coder replacement / automated social science coding.
- `Törnberg`: political Twitter message annotation with zero-shot LLM judging.
- `Ziems et al.`: broader computational social science task family, likely via a scoped subset.
- `Santurkar et al.`: opinion-reflection / survey-style evaluator case.
- `Zheng et al. / MT-Bench`: clean LLM-as-a-judge comparator outside the contested political core.

### Methods / framing / companion literature

- `Stureborg et al.`: evaluator inconsistency and bias.
- `Wei et al.`: judge sensitivity in alignment-evaluation settings.
- `Thakur et al.`: judge robustness / vulnerabilities.
- `Shi et al.`: position bias in LLM-as-a-judge.

## Export-Level Interpretation

The export does not support a "target everything" plan. It supports this structure:

- 2 to 3 flagship audit targets that are high-payoff and reconstructable.
- 1 clean comparator target from mainstream LLM-as-a-judge.
- several methods papers used mainly for framing, triangulation, or a narrow companion case.

## Implication For V4

The shortlist should be selected using four first-order filters:

- can we recover the evidence universe cleanly;
- can we reconstruct the rubric or prompting protocol without inventing too much;
- does the task expose regime sensitivity in a way `judge-gym` can measure;
- can we audit the paper fairly without building a strawman approximation.
