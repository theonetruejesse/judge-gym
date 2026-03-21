import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import {
  LlmPromptTemplatesTableSchema,
  LlmAttemptPayloadsTableSchema,
  LlmAttemptsTableSchema,
} from "./models/attempts";
import { EvidencesTableSchema, WindowRunsTableSchema, WindowsTableSchema } from "./models/window";
import {
  ExperimentsTableSchema,
  RunsTableSchema,
} from "./models/experiments";
import {
  PoolEvidencesTableSchema,
  PoolsTableSchema
} from "./models/window";
import {
  BundlePlanItemsTableSchema,
  BundlePlansTableSchema,
} from "./models/bundles";
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
    .index("by_process", ["process_kind", "process_id"])
    .index("by_process_stage", ["process_kind", "process_id", "stage"])
    .index("by_target", ["target_type", "target_id"])
    .index("by_status", ["status"]),
  llm_attempt_payloads: defineTable(zodOutputToConvex(LlmAttemptPayloadsTableSchema))
    .index("by_attempt", ["attempt_id"])
    .index("by_attempt_kind", ["attempt_id", "kind"]),
  windows: defineTable(zodOutputToConvex(WindowsTableSchema))
    .index("by_window_tag", ["window_tag"]),
  window_runs: defineTable(zodOutputToConvex(WindowRunsTableSchema))
    .index("by_status", ["status"])
    .index("by_window", ["window_id"]),
  evidences: defineTable(zodOutputToConvex(EvidencesTableSchema))
    .index("by_window_id", ["window_id"])
    .index("by_window_run_id", ["window_run_id"]),
  pools: defineTable(zodOutputToConvex(PoolsTableSchema))
    .index("by_pool_tag", ["pool_tag"]),
  pool_evidences: defineTable(zodOutputToConvex(PoolEvidencesTableSchema))
    .index("by_pool", ["pool_id"]),
  bundle_plans: defineTable(zodOutputToConvex(BundlePlansTableSchema))
    .index("by_bundle_plan_tag", ["bundle_plan_tag"])
    .index("by_pool", ["pool_id"])
    .index("by_pool_strategy_bundle_size", ["pool_id", "strategy", "bundle_size"]),
  bundle_plan_items: defineTable(zodOutputToConvex(BundlePlanItemsTableSchema))
    .index("by_bundle_plan", ["bundle_plan_id"])
    .index("by_bundle_plan_bundle", ["bundle_plan_id", "bundle_index"])
    .index("by_evidence", ["evidence_id"]),
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema))
    .index("by_experiment_tag", ["experiment_tag"])
    .index("by_pool", ["pool_id"])
    .index("by_bundle_plan", ["bundle_plan_id"]),
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
    .index("by_score_target", ["score_target_id"])
    .index("by_evidence", ["evidence_id"])
    .index("by_window", ["window_id"]),
  process_observability: defineTable(zodOutputToConvex(ProcessObservabilityTableSchema))
    .index("by_process", ["process_type", "process_id"])
    .index("by_trace", ["trace_id"])
    .index("by_updated_at", ["updated_at_ms"]),
});
