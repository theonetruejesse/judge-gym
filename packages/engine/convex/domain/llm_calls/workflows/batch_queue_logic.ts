import { ENGINE_SETTINGS } from "../../../settings";
import type {
  LlmStage,
  ModelType,
  Provider,
  RunDesiredState,
  RunPolicy,
} from "../../../models/core";

export type QueuedRequest = {
  _id: string;
  experiment_id: string | null;
  provider: Provider;
  model: ModelType;
  stage: LlmStage;
  user_prompt?: string | null;
  next_retry_at?: number;
  attempt: number;
};

export type RunCandidate = {
  _id: string;
  experiment_id: string;
  desired_state: RunDesiredState;
  stop_at_stage?: LlmStage;
  updated_at?: number;
  policy: RunPolicy;
  active_batches?: number;
};

const STAGE_ORDER: LlmStage[] = [
  "evidence_clean",
  "evidence_neutralize",
  "evidence_abstract",
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

function stageIndex(stage: LlmStage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}

export function policyAllows(
  policy: RunPolicy,
  provider: Provider,
  model: ModelType,
) {
  return policy.provider_models.some(
    (spec) => spec.provider === provider && spec.models.includes(model),
  );
}

export function selectBatchCandidates(args: {
  queued: QueuedRequest[];
  runs: RunCandidate[];
  provider: Provider;
  model: ModelType;
  max_items: number;
  now: number;
}): {
  items: QueuedRequest[];
  run_id?: string;
  policy?: RunPolicy;
} {
  const { queued, runs, provider, model, max_items, now } = args;

  const filtered = queued.filter(
    (req) =>
      req.provider === provider &&
      req.model === model &&
      Boolean(req.user_prompt) &&
      (!req.next_retry_at || req.next_retry_at <= now),
  );

  const activeRuns = new Map<string, RunCandidate>();
  if (filtered.some((req) => req.experiment_id)) {
    for (const run of runs) {
      const existing = activeRuns.get(run.experiment_id);
      if (!existing || (run.updated_at ?? 0) > (existing.updated_at ?? 0)) {
        activeRuns.set(run.experiment_id, run);
      }
    }
  }

  const runnable = filtered.filter((req) => {
    if (!req.experiment_id) return true;
    const run = activeRuns.get(req.experiment_id);
    if (!run) return true;
    if (run.desired_state !== "running") return false;
    if (!policyAllows(run.policy, req.provider, req.model)) return false;
    if (
      run.policy.max_concurrent_batches !== undefined &&
      (run.active_batches ?? 0) >= run.policy.max_concurrent_batches
    ) {
      return false;
    }
    if (run.stop_at_stage) {
      return stageIndex(req.stage) <= stageIndex(run.stop_at_stage);
    }
    return true;
  });

  const grouped = new Map<
    string,
    {
      run_id?: string;
      policy?: RunPolicy;
      items: QueuedRequest[];
    }
  >();

  for (const req of runnable) {
    const run = req.experiment_id ? activeRuns.get(req.experiment_id) : undefined;
    const key = run?._id ?? "none";
    const entry = grouped.get(key) ?? {
      run_id: run?._id,
      policy: run?.policy,
      items: [],
    };
    entry.items.push(req);
    grouped.set(key, entry);
  }

  const selected = Array.from(grouped.values()).sort(
    (a, b) => b.items.length - a.items.length,
  )[0];
  if (!selected) return { items: [] };

  const policyMax =
    (selected.policy ?? ENGINE_SETTINGS.run_policy).max_batch_size ??
    Number.POSITIVE_INFINITY;
  const cap = Math.min(max_items, policyMax);
  const items = selected.items.slice(0, cap);

  return {
    items,
    run_id: selected.run_id,
    policy: selected.policy,
  };
}
