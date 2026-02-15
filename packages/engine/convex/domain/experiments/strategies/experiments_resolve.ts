import {
  resolveScoringStrategy,
  type ScoringStrategy,
} from "./experiments_scoring.strategy";
import {
  resolveScaleStrategy,
  type ScaleStrategy,
} from "./experiments_scale.strategy";
import {
  resolveEvidenceStrategy,
  type EvidenceStrategy,
} from "./experiments_evidence.strategy";
import {
  resolveRandomizationStrategy,
  type RandomizationStrategy,
} from "./experiments_randomization.strategy";
import type { ExperimentConfig } from "../../../models/core";

export interface ResolvedStrategies {
  scoring: ScoringStrategy;
  scale: ScaleStrategy;
  evidence: EvidenceStrategy;
  randomization: RandomizationStrategy;
}

/**
 * Resolve and compose all experiment strategies from an ExperimentConfig.
 *
 * @param config - The experiment configuration used to determine each strategy
 * @returns An object containing the resolved `scoring`, `scale`, `evidence`, and `randomization` strategies
 */
export function resolveAll(config: ExperimentConfig): ResolvedStrategies {
  return {
    scoring: resolveScoringStrategy(config),
    scale: resolveScaleStrategy(config),
    evidence: resolveEvidenceStrategy(config),
    randomization: resolveRandomizationStrategy(config),
  };
}
