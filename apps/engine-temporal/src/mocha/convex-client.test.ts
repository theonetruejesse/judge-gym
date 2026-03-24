import assert from "assert";
import { describe, it } from "mocha";
import { ConvexWorkerClient } from "../convex/client";

describe("convex worker client", () => {
  it("fails fast before issuing a run execution context query without run_id", () => {
    const client = new ConvexWorkerClient("https://example.invalid");
    assert.throws(
      () => client.getRunExecutionContext(undefined as unknown as string),
      /run_id is required/,
    );
  });
});
