import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import {
  LlmPromptTemplatesTableSchema,
  LlmAttemptPayloadsTableSchema,
  LlmAttemptsTableSchema,
} from "./models/attempts";
import { LlmBatchExecutionsTableSchema } from "./models/batches";
import {
  ExperimentsTableSchema,
  RunsTableSchema,
} from "./models/experiments";
import {
  AcquisitionRunsTableSchema,
  AcquisitionSpecsTableSchema,
  EvidenceAssetsTableSchema,
  EvidenceCandidatesTableSchema,
  EvidenceItemsTableSchema,
  EvidenceSetItemsTableSchema,
  EvidenceSetsTableSchema,
  EvidenceUniverseTableSchema,
  EvidenceViewsTableSchema,
} from "./models/evidence";
import {
  SamplesTableSchema,
  RubricsTableSchema,
  RubricCriticsTableSchema,
  ScoresTableSchema,
  ScoreCriticsTableSchema,
  SampleScoreTargetsTableSchema,
  SampleScoreTargetItemsTableSchema,
} from "./models/samples";
import { ProcessObservabilityTableSchema } from "./models/telemetry";

export default defineSchema({
  llm_prompt_templates: defineTable(zodOutputToConvex(LlmPromptTemplatesTableSchema))
    .index("by_content_hash", ["content_hash"]),
  llm_attempts: defineTable(zodOutputToConvex(LlmAttemptsTableSchema))
    .index("by_attempt_key", ["attempt_key"])
    .index("by_process", ["process_kind", "process_id"])
    .index("by_process_stage", ["process_kind", "process_id", "stage"])
    .index("by_target", ["target_type", "target_id"])
    .index("by_status", ["status"]),
  llm_attempt_payloads: defineTable(zodOutputToConvex(LlmAttemptPayloadsTableSchema))
    .index("by_process", ["process_kind", "process_id"])
    .index("by_attempt", ["attempt_id"])
    .index("by_attempt_kind", ["attempt_id", "kind"]),
  llm_batch_executions: defineTable(zodOutputToConvex(LlmBatchExecutionsTableSchema))
    .index("by_batch_key", ["batch_key"])
    .index("by_process_stage", ["process_kind", "process_id", "stage"]),
  evidence_universes: defineTable(zodOutputToConvex(EvidenceUniverseTableSchema))
    .index("by_universe_tag", ["universe_tag"])
    .index("by_kind", ["kind"]),
  acquisition_specs: defineTable(zodOutputToConvex(AcquisitionSpecsTableSchema))
    .index("by_universe", ["universe_id"])
    .index("by_spec_tag", ["spec_tag"])
    .index("by_universe_spec_tag", ["universe_id", "spec_tag"]),
  acquisition_runs: defineTable(zodOutputToConvex(AcquisitionRunsTableSchema))
    .index("by_spec", ["acquisition_spec_id"])
    .index("by_status", ["status"]),
  evidence_assets: defineTable(zodOutputToConvex(EvidenceAssetsTableSchema))
    .index("by_content_hash", ["content_hash"])
    .index("by_role", ["role"]),
  evidence_candidates: defineTable(zodOutputToConvex(EvidenceCandidatesTableSchema))
    .index("by_run", ["acquisition_run_id"])
    .index("by_universe_provider_external", ["universe_id", "discovery_provider", "external_id"])
    .index("by_universe_url", ["universe_id", "url"]),
  evidence_items: defineTable(zodOutputToConvex(EvidenceItemsTableSchema))
    .index("by_universe", ["universe_id"])
    .index("by_candidate", ["candidate_id"])
    .index("by_canonical_key", ["canonical_key"])
    .index("by_hydration_status", ["hydration_status"]),
  evidence_sets: defineTable(zodOutputToConvex(EvidenceSetsTableSchema))
    .index("by_universe", ["universe_id"])
    .index("by_evidence_set_tag", ["evidence_set_tag"])
    .index("by_universe_tag", ["universe_id", "evidence_set_tag"]),
  evidence_set_items: defineTable(zodOutputToConvex(EvidenceSetItemsTableSchema))
    .index("by_set", ["evidence_set_id"])
    .index("by_item", ["evidence_item_id"])
    .index("by_set_item", ["evidence_set_id", "evidence_item_id"]),
  evidence_views: defineTable(zodOutputToConvex(EvidenceViewsTableSchema))
    .index("by_item", ["evidence_item_id"])
    .index("by_item_view", ["evidence_item_id", "view_kind"])
    .index("by_attempt", ["attempt_id"]),
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema))
    .index("by_experiment_tag", ["experiment_tag"])
    .index("by_evidence_set", ["evidence_set_id"]),
  runs: defineTable(zodOutputToConvex(RunsTableSchema))
    .index("by_experiment", ["experiment_id"]),
  samples: defineTable(zodOutputToConvex(SamplesTableSchema))
    .index("by_run", ["run_id"])
    .index("by_rubric_id", ["rubric_id"])
    .index("by_rubric_critic_id", ["rubric_critic_id"]),
  rubrics: defineTable(zodOutputToConvex(RubricsTableSchema))
    .index("by_sample", ["sample_id"])
    .index("by_run", ["run_id"]),
  rubric_critics: defineTable(zodOutputToConvex(RubricCriticsTableSchema))
    .index("by_sample", ["sample_id"])
    .index("by_run", ["run_id"]),
  scores: defineTable(zodOutputToConvex(ScoresTableSchema))
    .index("by_sample", ["sample_id"])
    .index("by_run", ["run_id"])
    .index("by_score_target", ["score_target_id"]),
  score_critics: defineTable(zodOutputToConvex(ScoreCriticsTableSchema))
    .index("by_sample", ["sample_id"])
    .index("by_run", ["run_id"])
    .index("by_score_target", ["score_target_id"]),
  sample_score_targets: defineTable(zodOutputToConvex(SampleScoreTargetsTableSchema))
    .index("by_run", ["run_id"])
    .index("by_sample", ["sample_id"])
    .index("by_score_id", ["score_id"])
    .index("by_score_critic_id", ["score_critic_id"]),
  sample_score_target_items: defineTable(zodOutputToConvex(SampleScoreTargetItemsTableSchema))
    .index("by_run", ["run_id"])
    .index("by_score_target", ["score_target_id"])
    .index("by_evidence_set_item", ["evidence_set_item_id"])
    .index("by_evidence_item", ["evidence_item_id"])
    .index("by_evidence_view", ["evidence_view_id"])
    .index("by_content_asset", ["content_asset_id"]),
  process_observability: defineTable(zodOutputToConvex(ProcessObservabilityTableSchema))
    .index("by_process", ["process_type", "process_id"])
    .index("by_trace", ["trace_id"])
    .index("by_updated_at", ["updated_at_ms"]),
});
