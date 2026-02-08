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
  resolveProbeStrategy,
  type ProbeStrategy,
} from "./probe.strategy";
import {
  resolveRandomizationStrategy,
  type RandomizationStrategy,
} from "./randomization.strategy";
import type { ExperimentConfig } from "../schema";

export interface ResolvedStrategies {
  scoring: ScoringStrategy;
  scale: ScaleStrategy;
  evidence: EvidenceStrategy;
  ordering: OrderingStrategy;
  probe: ProbeStrategy;
  randomization: RandomizationStrategy;
}

export function resolveAll(config: ExperimentConfig): ResolvedStrategies {
  return {
    scoring: resolveScoringStrategy(config),
    scale: resolveScaleStrategy(config),
    evidence: resolveEvidenceStrategy(config),
    ordering: resolveOrderingStrategy(config),
    probe: resolveProbeStrategy(config),
    randomization: resolveRandomizationStrategy(config),
  };
}
