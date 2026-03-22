import assert from "assert";
import { describe, it } from "mocha";
import { ConvexWorkerClient } from "../convex/client";

describe("convex worker client", () => {
  it("fails fast before issuing a window execution context query without window_run_id", () => {
    const client = new ConvexWorkerClient("https://example.invalid");
    assert.throws(
      () => client.getWindowExecutionContext(undefined as unknown as string),
      /window_run_id is required/,
    );
  });
});
