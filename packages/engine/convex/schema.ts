import { zodOutputToConvex } from "convex-helpers/server/zod4";
import { defineSchema, defineTable } from "convex/server";
import { LlmBatchesTableSchema, LlmJobsTableSchema, LlmRequestsTableSchema } from "./models/llm_calls";
import { EvidencesTableSchema, WindowsTableSchema } from "./models/window";
import { ExperimentEvidencesTableSchema, ExperimentsTableSchema, RunsTableSchema } from "./models/experiments";
import {
  SamplesTableSchema,
  RubricsTableSchema,
  RubricCriticsTableSchema,
  ScoresTableSchema,
  ScoreCriticsTableSchema,
  SampleEvidenceScoresTableSchema,
} from "./models/samples";
import {
  TelemetryEntityStateTableSchema,
  TelemetryEventsTableSchema,
  TelemetryTraceCountersTableSchema,
} from "./models/telemetry";

export default defineSchema({
  llm_batches: defineTable(zodOutputToConvex(LlmBatchesTableSchema))
    .index("by_status", ["status"]),
  llm_jobs: defineTable(zodOutputToConvex(LlmJobsTableSchema))
    .index("by_status", ["status"]),
  llm_requests: defineTable(zodOutputToConvex(LlmRequestsTableSchema))
    .index("by_status", ["status"])
    .index("by_batch_id", ["batch_id"])
    .index("by_job_id", ["job_id"])
    .index("by_orphaned", ["status", "batch_id", "job_id"])
    .index("by_custom_key", ["custom_key"])
    .index("by_custom_key_status", ["custom_key", "status"]),
  windows: defineTable(zodOutputToConvex(WindowsTableSchema)).index("by_status", ["status"]),
  evidences: defineTable(zodOutputToConvex(EvidencesTableSchema))
    .index("by_window_id", ["window_id"])
    .index("by_window_l1_pending", ["window_id", "l1_cleaned_content", "l1_request_id"])
    .index("by_window_l2_pending", ["window_id", "l2_neutralized_content", "l2_request_id"])
    .index("by_window_l3_pending", ["window_id", "l3_abstracted_content", "l3_request_id"])
    .index("by_l1_id", ["l1_request_id"])
    .index("by_l2_id", ["l2_request_id"])
    .index("by_l3_id", ["l3_request_id"]),
  experiments: defineTable(zodOutputToConvex(ExperimentsTableSchema)),
  experiment_evidence: defineTable(zodOutputToConvex(ExperimentEvidencesTableSchema))
    .index("by_experiment", ["experiment_id"]),
  runs: defineTable(zodOutputToConvex(RunsTableSchema))
    .index("by_experiment", ["experiment_id"]),
  samples: defineTable(zodOutputToConvex(SamplesTableSchema))
    .index("by_run", ["run_id"])
    .index("by_rubric_id", ["rubric_id"])
    .index("by_rubric_critic_id", ["rubric_critic_id"])
    .index("by_score_id", ["score_id"])
    .index("by_score_critic_id", ["score_critic_id"]),
  rubrics: defineTable(zodOutputToConvex(RubricsTableSchema)).index("by_sample", ["sample_id"]),
  rubric_critics: defineTable(zodOutputToConvex(RubricCriticsTableSchema)).index("by_sample", ["sample_id"]),
  scores: defineTable(zodOutputToConvex(ScoresTableSchema)).index("by_sample", ["sample_id"]),
  score_critics: defineTable(zodOutputToConvex(ScoreCriticsTableSchema)).index("by_sample", ["sample_id"]),
  sample_evidence_scores: defineTable(zodOutputToConvex(SampleEvidenceScoresTableSchema))
    .index("by_run", ["run_id"])
    .index("by_sample", ["sample_id"])
    .index("by_evidence", ["evidence_id"])
    .index("by_score_id", ["score_id"])
    .index("by_score_critic_id", ["score_critic_id"])
    .index("by_sample_evidence", ["sample_id", "evidence_id"]),
  telemetry_events: defineTable(zodOutputToConvex(TelemetryEventsTableSchema))
    .index("by_trace_seq", ["trace_id", "seq"])
    .index("by_entity_ts", ["entity_type", "entity_id", "ts_ms"]),
  telemetry_trace_counters: defineTable(zodOutputToConvex(TelemetryTraceCountersTableSchema))
    .index("by_trace_id", ["trace_id"]),
  telemetry_entity_state: defineTable(zodOutputToConvex(TelemetryEntityStateTableSchema))
    .index("by_entity", ["entity_type", "entity_id"])
    .index("by_trace_entity", ["trace_id", "entity_type", "entity_id"])
    .index("by_last_ts", ["last_ts_ms"]),
});
