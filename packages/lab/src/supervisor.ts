import { api, httpClient } from "./helpers/clients";
import { RunPolicySchema, type RunPolicy } from "@judge-gym/engine";
import { RUN_POLICY } from "./run_policy";

export type ProviderModelSpec = {
  provider: RunPolicy["provider_models"][number]["provider"];
  models: RunPolicy["provider_models"][number]["models"];
};

export type SupervisorConfig = RunPolicy;

export type SupervisorTickResult = {
  submitted_batches: number;
  polled_batches: number;
  errors: string[];
};

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = RUN_POLICY;

export class LabSupervisor {
  private config: SupervisorConfig;

  constructor(config: Partial<SupervisorConfig> = {}) {
    this.config = RunPolicySchema.parse({
      ...DEFAULT_SUPERVISOR_CONFIG,
      ...config,
    });
  }

  getConfig(): SupervisorConfig {
    return this.config;
  }

  async tick(): Promise<SupervisorTickResult> {
    const errors: string[] = [];
    let submitted_batches = 0;
    let polled_batches = 0;

    const now = Date.now();
    try {
      const due = await httpClient.query(api.lab.listBatchesDueForPolling, {
        now,
      });
      for (const batch of due.slice(0, this.config.max_poll_per_tick)) {
        try {
          await httpClient.action(api.lab.pollBatch, {
            batch_id: batch.batch_id,
            provider: batch.provider,
          });
          polled_batches += 1;
        } catch (err) {
          errors.push(
            `poll ${batch.batch_id}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      errors.push(
        `listBatchesDueForPolling: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    let created = 0;
    for (const spec of this.config.provider_models) {
      for (const model of spec.models) {
        if (created >= this.config.max_new_batches_per_tick) break;
        try {
          const { batch_id } = await httpClient.mutation(
            api.lab.createBatchFromQueued,
            {
              provider: spec.provider,
              model,
              max_items: this.config.max_batch_size,
            },
          );
          if (!batch_id) continue;
          await httpClient.action(api.lab.submitBatch, {
            batch_id,
            provider: spec.provider,
          });
          submitted_batches += 1;
          created += 1;
        } catch (err) {
          errors.push(
            `submit ${spec.provider}:${model}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }

    return { submitted_batches, polled_batches, errors };
  }
}
