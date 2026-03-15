import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import {
  LlmBatchesTableSchema,
  LlmJobsTableSchema,
  LlmPromptTemplatesTableSchema,
  LlmRequestsTableSchema,
  ProcessRequestTargetStateTableSchema,
} from "./models/llm_calls";
import { EvidencesTableSchema, WindowsTableSchema } from "./models/window";
import {
  ExperimentsTableSchema,
  RunsTableSchema,
} from "./models/experiments";
import {
  PoolEvidencesTableSchema,
  PoolsTableSchema
} from "./models/window";
import {
  SamplesTableSchema,
  RubricsTableSchema,
  RubricCriticsTableSchema,
  ScoresTableSchema,
  ScoreCriticsTableSchema,
  SampleScoreTargetsTableSchema,
  SampleScoreTargetItemsTableSchema,
} from "./models/samples";
import {
  ProcessObservabilityTableSchema,
  SchedulerLockTableSchema,
} from "./models/telemetry";

export default defineSchema({
  llm_prompt_templates: defineTable(zodOutputToConvex(LlmPromptTemplatesTableSchema))
    .index("by_content_hash", ["content_hash"]),
  llm_batches: defineTable(zodOutputToConvex(LlmBatchesTableSchema))
    .index("by_status", ["status"])
    .index("by_custom_key_status", ["custom_key", "status"])
    .index("by_custom_key_attempt_index", ["custom_key", "attempt_index"]),
  llm_jobs: defineTable(zodOutputToConvex(LlmJobsTableSchema))
    .index("by_status", ["status"])
    .index("by_custom_key_status", ["custom_key", "status"])
    .index("by_custom_key_attempt_index", ["custom_key", "attempt_index"]),
  llm_requests: defineTable(zodOutputToConvex(LlmRequestsTableSchema))
    .index("by_status", ["status"])
    .index("by_run", ["run_id"])
    .index("by_batch_id", ["batch_id"])
    .index("by_job_id", ["job_id"])
    .index("by_orphaned", ["status", "batch_id", "job_id"])
    .index("by_custom_key", ["custom_key"])
    .index("by_custom_key_status", ["custom_key", "status"]),
  process_request_targets: defineTable(zodOutputToConvex(ProcessRequestTargetStateTableSchema))
    .index("by_process", ["process_type", "process_id"])
    .index("by_process_stage", ["process_type", "process_id", "stage"])
    .index("by_resolution", ["resolution"])
    .index("by_custom_key", ["custom_key"]),
  windows: defineTable(zodOutputToConvex(WindowsTableSchema)).index("by_status", ["status"]),
  evidences: defineTable(zodOutputToConvex(EvidencesTableSchema))
    .index("by_window_id", ["window_id"])
    .index("by_window_l1_pending", ["window_id", "l1_cleaned_content", "l1_request_id"])
    .index("by_window_l2_pending", ["window_id", "l2_neutralized_content", "l2_request_id"])
    .index("by_window_l3_pending", ["window_id", "l3_abstracted_content", "l3_request_id"])
    .index("by_l1_id", ["l1_request_id"])
    .index("by_l2_id", ["l2_request_id"])
    .index("by_l3_id", ["l3_request_id"]),
  pools: defineTable(zodOutputToConvex(PoolsTableSchema))
    .index("by_pool_tag", ["pool_tag"]),
  pool_evidences: defineTable(zodOutputToConvex(PoolEvidencesTableSchema))
    .index("by_pool", ["pool_id"]),
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema))
    .index("by_pool", ["pool_id"]),
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
  scheduler_locks: defineTable(zodOutputToConvex(SchedulerLockTableSchema))
    .index("by_lock_key", ["lock_key"])
    .index("by_expires_at", ["expires_at_ms"]),
});
