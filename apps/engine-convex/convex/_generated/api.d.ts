/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as domain_exports_analysis_export from "../domain/exports/analysis_export.js";
import type * as domain_maintenance_codex from "../domain/maintenance/codex.js";
import type * as domain_maintenance_danger from "../domain/maintenance/danger.js";
import type * as domain_maintenance_process_debug from "../domain/maintenance/process_debug.js";
import type * as domain_maintenance_v3_campaign from "../domain/maintenance/v3_campaign.js";
import type * as domain_runs_bundle_plan_materializer from "../domain/runs/bundle_plan_materializer.js";
import type * as domain_runs_bundle_plan_repo from "../domain/runs/bundle_plan_repo.js";
import type * as domain_runs_experiment_progress from "../domain/runs/experiment_progress.js";
import type * as domain_runs_experiments_repo from "../domain/runs/experiments_repo.js";
import type * as domain_runs_experiments_service from "../domain/runs/experiments_service.js";
import type * as domain_runs_pool_repo from "../domain/runs/pool_repo.js";
import type * as domain_runs_run_parsers from "../domain/runs/run_parsers.js";
import type * as domain_runs_run_progress from "../domain/runs/run_progress.js";
import type * as domain_runs_run_repo from "../domain/runs/run_repo.js";
import type * as domain_runs_run_service from "../domain/runs/run_service.js";
import type * as domain_runs_sample_progress from "../domain/runs/sample_progress.js";
import type * as domain_telemetry_emit from "../domain/telemetry/emit.js";
import type * as domain_telemetry_events from "../domain/telemetry/events.js";
import type * as domain_temporal_schemas from "../domain/temporal/schemas.js";
import type * as domain_temporal_temporal_client from "../domain/temporal/temporal_client.js";
import type * as domain_window_evidence_search from "../domain/window/evidence_search.js";
import type * as domain_window_window_repo from "../domain/window/window_repo.js";
import type * as models__shared from "../models/_shared.js";
import type * as models_attempts from "../models/attempts.js";
import type * as models_bundles from "../models/bundles.js";
import type * as models_experiments from "../models/experiments.js";
import type * as models_samples from "../models/samples.js";
import type * as models_telemetry from "../models/telemetry.js";
import type * as models_window from "../models/window.js";
import type * as packages_analysis from "../packages/analysis.js";
import type * as packages_codex from "../packages/codex.js";
import type * as packages_lab from "../packages/lab.js";
import type * as packages_worker from "../packages/worker.js";
import type * as utils_custom_fns from "../utils/custom_fns.js";
import type * as utils_env_preflight from "../utils/env_preflight.js";
import type * as utils_randomize from "../utils/randomize.js";
import type * as utils_tags from "../utils/tags.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "domain/exports/analysis_export": typeof domain_exports_analysis_export;
  "domain/maintenance/codex": typeof domain_maintenance_codex;
  "domain/maintenance/danger": typeof domain_maintenance_danger;
  "domain/maintenance/process_debug": typeof domain_maintenance_process_debug;
  "domain/maintenance/v3_campaign": typeof domain_maintenance_v3_campaign;
  "domain/runs/bundle_plan_materializer": typeof domain_runs_bundle_plan_materializer;
  "domain/runs/bundle_plan_repo": typeof domain_runs_bundle_plan_repo;
  "domain/runs/experiment_progress": typeof domain_runs_experiment_progress;
  "domain/runs/experiments_repo": typeof domain_runs_experiments_repo;
  "domain/runs/experiments_service": typeof domain_runs_experiments_service;
  "domain/runs/pool_repo": typeof domain_runs_pool_repo;
  "domain/runs/run_parsers": typeof domain_runs_run_parsers;
  "domain/runs/run_progress": typeof domain_runs_run_progress;
  "domain/runs/run_repo": typeof domain_runs_run_repo;
  "domain/runs/run_service": typeof domain_runs_run_service;
  "domain/runs/sample_progress": typeof domain_runs_sample_progress;
  "domain/telemetry/emit": typeof domain_telemetry_emit;
  "domain/telemetry/events": typeof domain_telemetry_events;
  "domain/temporal/schemas": typeof domain_temporal_schemas;
  "domain/temporal/temporal_client": typeof domain_temporal_temporal_client;
  "domain/window/evidence_search": typeof domain_window_evidence_search;
  "domain/window/window_repo": typeof domain_window_window_repo;
  "models/_shared": typeof models__shared;
  "models/attempts": typeof models_attempts;
  "models/bundles": typeof models_bundles;
  "models/experiments": typeof models_experiments;
  "models/samples": typeof models_samples;
  "models/telemetry": typeof models_telemetry;
  "models/window": typeof models_window;
  "packages/analysis": typeof packages_analysis;
  "packages/codex": typeof packages_codex;
  "packages/lab": typeof packages_lab;
  "packages/worker": typeof packages_worker;
  "utils/custom_fns": typeof utils_custom_fns;
  "utils/env_preflight": typeof utils_env_preflight;
  "utils/randomize": typeof utils_randomize;
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

export declare const components: {};
