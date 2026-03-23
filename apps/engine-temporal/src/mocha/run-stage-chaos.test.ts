import assert from "assert";
import { describe, it } from "mocha";
import {
  isRunStageChaosTarget,
  maybeInjectRunStageChaosAssistantOutput,
  RUN_STAGE_CHAOS_EXPERIMENT_IDS,
} from "../run/stage_chaos";

function findSelectedTarget(stage: "rubric_gen" | "score_gen") {
  const experimentId = RUN_STAGE_CHAOS_EXPERIMENT_IDS.values().next().value as string;
  for (let index = 0; index < 10_000; index += 1) {
    const targetId = `target_${index}`;
    if (isRunStageChaosTarget({
      experimentId,
      stage,
      targetId,
      attemptOrdinal: 1,
    })) {
      return { experimentId, targetId };
    }
  }
  throw new Error(`No selected target found for ${stage}`);
}

describe("run stage chaos injection", () => {
  it("injects parse faults only for selected experiments and the first two attempts", () => {
    const { experimentId, targetId } = findSelectedTarget("score_gen");

    assert.equal(isRunStageChaosTarget({
      experimentId,
      stage: "score_gen",
      targetId,
      attemptOrdinal: 1,
    }), true);
    assert.equal(isRunStageChaosTarget({
      experimentId,
      stage: "score_gen",
      targetId,
      attemptOrdinal: 2,
    }), true);
    assert.equal(isRunStageChaosTarget({
      experimentId,
      stage: "score_gen",
      targetId,
      attemptOrdinal: 3,
    }), false);

    const injected = maybeInjectRunStageChaosAssistantOutput({
      experimentId,
      runId: "run_chaos",
      stage: "score_gen",
      targetId,
      attemptOrdinal: 1,
      assistantOutput: "VERDICT: A",
    });
    assert.match(injected, /VERDICT: XoxW0/);

    const skipped = maybeInjectRunStageChaosAssistantOutput({
      experimentId: "exp_control",
      runId: "run_control",
      stage: "score_gen",
      targetId,
      attemptOrdinal: 1,
      assistantOutput: "VERDICT: A",
    });
    assert.equal(skipped, "VERDICT: A");
  });

  it("uses stage-specific malformed payloads", () => {
    const { experimentId, targetId } = findSelectedTarget("rubric_gen");
    const rubricOutput = maybeInjectRunStageChaosAssistantOutput({
      experimentId,
      runId: "run_chaos",
      stage: "rubric_gen",
      targetId,
      attemptOrdinal: 1,
      assistantOutput: "RUBRIC:\n1) A :: one; two; three",
    });
    assert.match(rubricOutput, /single criterion only/);
  });
});
