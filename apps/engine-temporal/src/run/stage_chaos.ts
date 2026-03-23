import type { RunStageKey } from "@judge-gym/engine-settings/process";

export const RUN_STAGE_CHAOS_EXPERIMENT_IDS = new Set([
  "jh7csph5fcv9b0tna3e186br0983a8wz",
  "jh7e5g6xqzcx5rkvb9gkj1max983a6xy",
  "jh71fjxfpcdx0n0dk3dxaknch983bgz9",
  "jh79aa6m4tpjqwhe1v5pjxw59d83b7tv",
  "jh74qam7zhvbs2kh3eske1pa1s83bvxf",
  "jh7c491gezspmm51kvsctb1rdd83avk6",
  "jh7b1dmfx6vrdh7m4nvb0zjvjh83bwke",
  "jh7eyawq412yw6aztngqtfh6zx83bych",
  "jh7b5sqg0zpmxxz627j306244s83bdcg",
]);

const CHAOS_ATTEMPT_LIMIT = 2;
const CHAOS_TARGET_MODULO = 8;
const CHAOS_TARGET_THRESHOLD = 1;

function stableHash(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function isRunStageChaosTarget(args: {
  experimentId: string;
  stage: RunStageKey;
  targetId: string;
  attemptOrdinal: number;
}) {
  if (!RUN_STAGE_CHAOS_EXPERIMENT_IDS.has(args.experimentId)) {
    return false;
  }
  if (args.attemptOrdinal > CHAOS_ATTEMPT_LIMIT) {
    return false;
  }
  return stableHash(`${args.stage}:${args.targetId}`) % CHAOS_TARGET_MODULO
    < CHAOS_TARGET_THRESHOLD;
}

function buildInvalidAssistantOutput(stage: RunStageKey) {
  switch (stage) {
    case "rubric_gen":
      return [
        "Reasoning: chaos parse fault",
        "RUBRIC:",
        "1) Clear but Limited Pattern :: single criterion only",
      ].join("\n");
    case "rubric_critic":
      return [
        "Reasoning: chaos parse fault",
        "EXPERT_AGREEMENT: definitely",
      ].join("\n");
    case "score_gen":
      return [
        "Reasoning: chaos parse fault",
        "VERDICT: XoxW0",
      ].join("\n");
    case "score_critic":
      return [
        "Reasoning: chaos parse fault",
        "EXPERT_AGREEMENT: definitely",
      ].join("\n");
  }
}

export function maybeInjectRunStageChaosAssistantOutput(args: {
  experimentId: string;
  runId: string;
  stage: RunStageKey;
  targetId: string;
  attemptOrdinal: number;
  assistantOutput: string;
}) {
  if (!isRunStageChaosTarget(args)) {
    return args.assistantOutput;
  }
  if (args.attemptOrdinal === 1) {
    console.warn(
      `[run.stage.chaos] injecting parse fault for ${args.stage} target ${args.targetId} in ${args.runId}`,
    );
  }
  return buildInvalidAssistantOutput(args.stage);
}
