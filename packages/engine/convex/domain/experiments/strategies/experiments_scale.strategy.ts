import type { ExperimentConfig } from "../../../models/core";

export interface ScaleStrategy {
  stageCount: number;
  hasMidpoint: boolean;
  midpointLabel: string | null;
  letterLabels: string[];
}

export function resolveScaleStrategy(
  config: ExperimentConfig,
): ScaleStrategy {
  const n = config.rubric_stage.scale_size;
  const isOdd = n % 2 === 1;
  const letters = Array.from({ length: n }, (_, i) =>
    String.fromCharCode(65 + i),
  );
  return {
    stageCount: n,
    hasMidpoint: isOdd,
    midpointLabel: isOdd ? letters[Math.floor(n / 2)] : null,
    letterLabels: letters,
  };
}
