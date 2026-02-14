import { RunPolicySchema, type RunPolicy } from "@judge-gym/engine";
import { RUN_POLICIES } from "./run_policy";

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

export const DEFAULT_SUPERVISOR_CONFIG: SupervisorConfig = RUN_POLICIES.global;

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
    return { submitted_batches: 0, polled_batches: 0, errors: [] };
  }
}
