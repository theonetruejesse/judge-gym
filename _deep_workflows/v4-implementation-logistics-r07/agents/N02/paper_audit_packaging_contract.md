# Paper-Audit Packaging Contract

## Do Not Swap Inputs Naively

The correct V4 import path is not “paste their rubric and evidence straight into a run.”

Instead, every paper target should be frozen as a package with four layers:

1. **Evidence layer**
   - imported into `evidence_universes`
   - curated into `evidence_sets`
   - pinned to `paper_original` or `source_text`

2. **Paper contract layer**
   - target id such as `gilardi_v1` or `zheng_mtbench_v1`
   - dataset slice id
   - compatibility mode
   - prompt template id
   - instructions blob
   - label space or rubric blob
   - output contract

3. **Experiment layer**
   - provider/model
   - abstention policy
   - evidence view
   - bundle size and strategy

4. **Freeze metadata**
   - package version
   - source provenance
   - import timestamp
   - evidence-set tag
   - transform version when a semantic view is used

## Proposed Control-Plane Addition

Add a first-class `paper_audit_packages` registry with records like:

- `package_tag`
- `target_family`
- `dataset_tag`
- `compatibility_mode`
- `prompt_template_key`
- `instructions_json`
- `label_space_json`
- `rubric_source_kind`
- `rubric_payload_json`
- `output_contract_json`
- `provenance_json`
- `default_evidence_view`

Experiments should then point at:

- `evidence_set_id`
- `paper_audit_package_id`

instead of scattering the full contract ad hoc into every experiment cell.

## Porting Process Per Target

### Gilardi

1. import released coding rows into a `paper_audit` universe
2. create a high-quality `literature_dataset` evidence set
3. pin each item to `paper_original` when released, else `source_text`
4. register `gilardi_faithful_v1`
5. run a 1-sample target canary with `output_contract.kind = label`
6. only after that, instantiate:
   - abstention-on
   - `l2_neutralized`
   - provider-panel cells

### Zheng / MT-Bench

1. import benchmark judgment units into a `benchmark` or `paper_audit` universe
2. create a frozen evidence set for the chosen slice
3. register `zheng_faithful_v1`
4. run a 1-sample canary to verify parser fidelity and prompt contract
5. only after that, instantiate:
   - abstention-on
   - provider-panel cells

## Canary Ladder

1. **Substrate smoke**
   - existing `bun run v4:smoke`
2. **Provider smoke**
   - extend smoke to include OpenRouter/Qwen
3. **Paper target canary**
   - `gilardi_canary`
   - `zheng_canary`
4. **Condition canary**
   - abstention-on
   - `l2_neutralized` where applicable
5. **Matrix execution**
   - only after target canaries are green
