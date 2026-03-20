/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as domain_analysis_export from "../domain/analysis/export.js";
import type * as domain_llm_calls_llm_batch_repo from "../domain/llm_calls/llm_batch_repo.js";
import type * as domain_llm_calls_llm_batch_service from "../domain/llm_calls/llm_batch_service.js";
import type * as domain_llm_calls_llm_job_repo from "../domain/llm_calls/llm_job_repo.js";
import type * as domain_llm_calls_llm_job_service from "../domain/llm_calls/llm_job_service.js";
import type * as domain_llm_calls_llm_request_repo from "../domain/llm_calls/llm_request_repo.js";
import type * as domain_maintenance_codex from "../domain/maintenance/codex.js";
import type * as domain_maintenance_danger from "../domain/maintenance/danger.js";
import type * as domain_maintenance_process_debug from "../domain/maintenance/process_debug.js";
import type * as domain_maintenance_v3_campaign from "../domain/maintenance/v3_campaign.js";
import type * as domain_orchestrator_base from "../domain/orchestrator/base.js";
import type * as domain_orchestrator_process_workflows from "../domain/orchestrator/process_workflows.js";
import type * as domain_orchestrator_scheduler from "../domain/orchestrator/scheduler.js";
import type * as domain_orchestrator_target_registry from "../domain/orchestrator/target_registry.js";
import type * as domain_runs_bundle_plan_logic from "../domain/runs/bundle_plan_logic.js";
import type * as domain_runs_bundle_plan_repo from "../domain/runs/bundle_plan_repo.js";
import type * as domain_runs_experiment_progress from "../domain/runs/experiment_progress.js";
import type * as domain_runs_experiments_data from "../domain/runs/experiments_data.js";
import type * as domain_runs_experiments_repo from "../domain/runs/experiments_repo.js";
import type * as domain_runs_run_orchestrator from "../domain/runs/run_orchestrator.js";
import type * as domain_runs_run_parsers from "../domain/runs/run_parsers.js";
import type * as domain_runs_run_progress from "../domain/runs/run_progress.js";
import type * as domain_runs_run_prompts from "../domain/runs/run_prompts.js";
import type * as domain_runs_run_repo from "../domain/runs/run_repo.js";
import type * as domain_runs_run_service from "../domain/runs/run_service.js";
import type * as domain_runs_run_strategies from "../domain/runs/run_strategies.js";
import type * as domain_runs_sample_progress from "../domain/runs/sample_progress.js";
import type * as domain_telemetry_emit from "../domain/telemetry/emit.js";
import type * as domain_telemetry_events from "../domain/telemetry/events.js";
import type * as domain_temporal_temporal_client from "../domain/temporal/temporal_client.js";
import type * as domain_window_evidence_prompts from "../domain/window/evidence_prompts.js";
import type * as domain_window_evidence_search from "../domain/window/evidence_search.js";
import type * as domain_window_window_orchestrator from "../domain/window/window_orchestrator.js";
import type * as domain_window_window_repo from "../domain/window/window_repo.js";
import type * as domain_window_window_service from "../domain/window/window_service.js";
import type * as models__shared from "../models/_shared.js";
import type * as models_attempts from "../models/attempts.js";
import type * as models_bundles from "../models/bundles.js";
import type * as models_experiments from "../models/experiments.js";
import type * as models_llm_calls from "../models/llm_calls.js";
import type * as models_samples from "../models/samples.js";
import type * as models_telemetry from "../models/telemetry.js";
import type * as models_window from "../models/window.js";
import type * as packages_analysis from "../packages/analysis.js";
import type * as packages_codex from "../packages/codex.js";
import type * as packages_lab from "../packages/lab.js";
import type * as packages_worker from "../packages/worker.js";
import type * as platform_providers_ai_chat from "../platform/providers/ai_chat.js";
import type * as platform_providers_openai_batch from "../platform/providers/openai_batch.js";
import type * as platform_providers_openai_chat from "../platform/providers/openai_chat.js";
import type * as platform_providers_provider_services from "../platform/providers/provider_services.js";
import type * as platform_providers_provider_types from "../platform/providers/provider_types.js";
import type * as platform_rate_limiter_index from "../platform/rate_limiter/index.js";
import type * as platform_rate_limiter_provider_tiers from "../platform/rate_limiter/provider_tiers.js";
import type * as platform_rate_limiter_types from "../platform/rate_limiter/types.js";
import type * as platform_run_policy from "../platform/run_policy.js";
import type * as settings from "../settings.js";
import type * as tests_provider_services_mock from "../tests/provider_services_mock.js";
import type * as utils_custom_fns from "../utils/custom_fns.js";
import type * as utils_env_preflight from "../utils/env_preflight.js";
import type * as utils_randomize from "../utils/randomize.js";
import type * as utils_scheduling from "../utils/scheduling.js";
import type * as utils_tags from "../utils/tags.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "domain/analysis/export": typeof domain_analysis_export;
  "domain/llm_calls/llm_batch_repo": typeof domain_llm_calls_llm_batch_repo;
  "domain/llm_calls/llm_batch_service": typeof domain_llm_calls_llm_batch_service;
  "domain/llm_calls/llm_job_repo": typeof domain_llm_calls_llm_job_repo;
  "domain/llm_calls/llm_job_service": typeof domain_llm_calls_llm_job_service;
  "domain/llm_calls/llm_request_repo": typeof domain_llm_calls_llm_request_repo;
  "domain/maintenance/codex": typeof domain_maintenance_codex;
  "domain/maintenance/danger": typeof domain_maintenance_danger;
  "domain/maintenance/process_debug": typeof domain_maintenance_process_debug;
  "domain/maintenance/v3_campaign": typeof domain_maintenance_v3_campaign;
  "domain/orchestrator/base": typeof domain_orchestrator_base;
  "domain/orchestrator/process_workflows": typeof domain_orchestrator_process_workflows;
  "domain/orchestrator/scheduler": typeof domain_orchestrator_scheduler;
  "domain/orchestrator/target_registry": typeof domain_orchestrator_target_registry;
  "domain/runs/bundle_plan_logic": typeof domain_runs_bundle_plan_logic;
  "domain/runs/bundle_plan_repo": typeof domain_runs_bundle_plan_repo;
  "domain/runs/experiment_progress": typeof domain_runs_experiment_progress;
  "domain/runs/experiments_data": typeof domain_runs_experiments_data;
  "domain/runs/experiments_repo": typeof domain_runs_experiments_repo;
  "domain/runs/run_orchestrator": typeof domain_runs_run_orchestrator;
  "domain/runs/run_parsers": typeof domain_runs_run_parsers;
  "domain/runs/run_progress": typeof domain_runs_run_progress;
  "domain/runs/run_prompts": typeof domain_runs_run_prompts;
  "domain/runs/run_repo": typeof domain_runs_run_repo;
  "domain/runs/run_service": typeof domain_runs_run_service;
  "domain/runs/run_strategies": typeof domain_runs_run_strategies;
  "domain/runs/sample_progress": typeof domain_runs_sample_progress;
  "domain/telemetry/emit": typeof domain_telemetry_emit;
  "domain/telemetry/events": typeof domain_telemetry_events;
  "domain/temporal/temporal_client": typeof domain_temporal_temporal_client;
  "domain/window/evidence_prompts": typeof domain_window_evidence_prompts;
  "domain/window/evidence_search": typeof domain_window_evidence_search;
  "domain/window/window_orchestrator": typeof domain_window_window_orchestrator;
  "domain/window/window_repo": typeof domain_window_window_repo;
  "domain/window/window_service": typeof domain_window_window_service;
  "models/_shared": typeof models__shared;
  "models/attempts": typeof models_attempts;
  "models/bundles": typeof models_bundles;
  "models/experiments": typeof models_experiments;
  "models/llm_calls": typeof models_llm_calls;
  "models/samples": typeof models_samples;
  "models/telemetry": typeof models_telemetry;
  "models/window": typeof models_window;
  "packages/analysis": typeof packages_analysis;
  "packages/codex": typeof packages_codex;
  "packages/lab": typeof packages_lab;
  "packages/worker": typeof packages_worker;
  "platform/providers/ai_chat": typeof platform_providers_ai_chat;
  "platform/providers/openai_batch": typeof platform_providers_openai_batch;
  "platform/providers/openai_chat": typeof platform_providers_openai_chat;
  "platform/providers/provider_services": typeof platform_providers_provider_services;
  "platform/providers/provider_types": typeof platform_providers_provider_types;
  "platform/rate_limiter/index": typeof platform_rate_limiter_index;
  "platform/rate_limiter/provider_tiers": typeof platform_rate_limiter_provider_tiers;
  "platform/rate_limiter/types": typeof platform_rate_limiter_types;
  "platform/run_policy": typeof platform_run_policy;
  settings: typeof settings;
  "tests/provider_services_mock": typeof tests_provider_services_mock;
  "utils/custom_fns": typeof utils_custom_fns;
  "utils/env_preflight": typeof utils_env_preflight;
  "utils/randomize": typeof utils_randomize;
  "utils/scheduling": typeof utils_scheduling;
  "utils/tags": typeof utils_tags;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: {
    lib: {
      checkRateLimit: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
      getValue: FunctionReference<
        "query",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          key?: string;
          name: string;
          sampleShards?: number;
        },
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          shard: number;
          ts: number;
          value: number;
        }
      >;
      rateLimit: FunctionReference<
        "mutation",
        "internal",
        {
          config:
            | {
                capacity?: number;
                kind: "token bucket";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: null;
              }
            | {
                capacity?: number;
                kind: "fixed window";
                maxReserved?: number;
                period: number;
                rate: number;
                shards?: number;
                start?: number;
              };
          count?: number;
          key?: string;
          name: string;
          reserve?: boolean;
          throws?: boolean;
        },
        { ok: true; retryAfter?: number } | { ok: false; retryAfter: number }
      >;
      resetRateLimit: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name: string },
        null
      >;
    };
    time: {
      getServerTime: FunctionReference<"mutation", "internal", {}, number>;
    };
  };
};
