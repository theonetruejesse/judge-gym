import assert from "assert";
import { describe, it } from "mocha";
import {
  buildQuotaBucketRefs,
  estimateTextTokens,
  resolveQuotaBucketPolicy,
} from "../quota";

describe("quota helpers", () => {
  it("builds provider/model/scope bucket refs for active dimensions", () => {
    const refs = buildQuotaBucketRefs({
      provider: "openai",
      model: "gpt-4.1-mini",
      operationType: "chat",
      scopeKey: "run:abc:rubric_gen",
      dimensions: {
        requests: 1,
        input_tokens: 120,
      },
    });

    assert.equal(refs.length, 6);
    assert.equal(refs.filter((ref) => ref.scope === "provider").length, 2);
    assert.equal(refs.filter((ref) => ref.scope === "model").length, 2);
    assert.equal(refs.filter((ref) => ref.scope === "scope").length, 2);
  });

  it("resolves model-level OpenAI quota policy", () => {
    const policy = resolveQuotaBucketPolicy(
      {
        scope: "model",
        dimension: "requests",
        key: "judge-gym:quota:openai:model:gpt-4.1-mini:requests:chat",
      },
      {
        provider: "openai",
        model: "gpt-4.1-mini",
      },
    );

    assert.equal(policy?.capacity, 30_000);
    assert.equal(policy?.rate, 30_000);
  });

  it("uses a stable text-to-token heuristic", () => {
    assert.equal(estimateTextTokens(""), 0);
    assert.equal(estimateTextTokens("abcd"), 1);
    assert.equal(estimateTextTokens("abcdefgh"), 2);
  });
});
