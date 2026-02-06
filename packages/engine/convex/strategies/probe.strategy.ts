import type { ExperimentConfig } from "../schema";

export interface ProbeStrategy {
  freshWindow: boolean;
  recentMessages: number;
}

export function resolveProbeStrategy(
  config: ExperimentConfig,
): ProbeStrategy {
  return {
    freshWindow: config.freshWindowProbe,
    recentMessages: config.freshWindowProbe ? 0 : 10,
  };
}
