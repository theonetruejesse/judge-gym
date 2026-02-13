import {
  resolveScoringStrategy,
  type ScoringStrategy,
} from "./scoring.strategy";
import {
  resolveScaleStrategy,
  type ScaleStrategy,
} from "./scale.strategy";
import {
  resolveEvidenceStrategy,
  type EvidenceStrategy,
} from "./evidence.strategy";
import {
  resolveOrderingStrategy,
  type OrderingStrategy,
} from "./ordering.strategy";
import {
  resolveRandomizationStrategy,
  type RandomizationStrategy,
} from "./randomization.strategy";
import type { ExperimentConfig } from "../../../models/core";

export interface ResolvedStrategies {
  scoring: ScoringStrategy;
  scale: ScaleStrategy;
  evidence: EvidenceStrategy;
  ordering: OrderingStrategy;
  randomization: RandomizationStrategy;
}

/**
 * Resolve and compose all experiment strategies from an ExperimentConfig.
 *
 * @param config - The experiment configuration used to determine each strategy
 * @returns An object containing the resolved `scoring`, `scale`, `evidence`, `ordering`, and `randomization` strategies
 */
export function resolveAll(config: ExperimentConfig): ResolvedStrategies {
  return {
    scoring: resolveScoringStrategy(config),
    scale: resolveScaleStrategy(config),
    evidence: resolveEvidenceStrategy(config),
    ordering: resolveOrderingStrategy(config),
    randomization: resolveRandomizationStrategy(config),
  };
}