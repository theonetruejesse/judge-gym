# V4 R05 GPT-4.1 Rerun Comparison

## `gilardi_relevance_v1_baseline_gpt41`

- Previous run: `kx76dvnb56czb099ay5jc0s9s583qncx`
- Rerun: `kx75b89bzxzptqahq2zsw510gh83qzvy`
- Label flip rate: 0/24 (0.0%)
- Previous labels: {'Relevant': 15, 'Irrelevant': 9}
- Rerun labels: {'Relevant': 15, 'Irrelevant': 9}
- Item-level changes: none

## `gilardi_relevance_v1_view_l2_neutralized_gpt41`

- Previous run: `kx756pkcv5tppkgeqqnqy3nbdn83qwy1`
- Rerun: `kx72vhjsdydjtxcrnm9et0qx4583qn0m`
- Label flip rate: 1/24 (4.2%)
- Previous labels: {'Relevant': 16, 'Irrelevant': 8}
- Rerun labels: {'Relevant': 17, 'Irrelevant': 7}
- Item-level changes:
  - `E20` Irrelevant -> Relevant (Gilardi relevance tweet 1259898963467132928)

## `zheng_mt_bench_pair_v2_v1_baseline_gpt41`

- Previous run: `kx77tkb9vy5ek2bpvdynapth5n83q0k9`
- Rerun: `kx70f510vq1keane2van7xs0f183qbxz`
- Label flip rate: 1/13 (7.7%)
- Previous labels: {'B': 4, 'A': 9}
- Rerun labels: {'B': 5, 'A': 8}
- Item-level changes:
  - `E8` A -> B (MT-Bench Q81 gpt-3.5-turbo vs claude-v1)

## `zheng_mt_bench_pair_v2_v1_abstention_on_gpt41`

- Previous run: `kx78bg0vfshkqh8896qmwekbv983q1gf`
- Rerun: `kx72nazw1k3cr8hy3yz22xt0rs83qgk3`
- Label flip rate: 0/13 (0.0%)
- Previous labels: {'B': 5, 'A': 8}
- Rerun labels: {'B': 5, 'A': 8}
- Item-level changes: none
