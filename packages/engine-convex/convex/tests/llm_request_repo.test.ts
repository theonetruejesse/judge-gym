import { describe, expect, test } from "vitest";
import { classifyRequestError } from "../domain/llm_calls/llm_request_repo";

describe("llm_request_repo", () => {
  test("classifyRequestError recognizes timed out strings as timeout", () => {
    expect(classifyRequestError("Your request timed out.")).toBe("timeout");
    expect(classifyRequestError("Deadline exceeded while reconciling stage")).toBe("timeout");
  });

  test("classifyRequestError recognizes rubric parser failures", () => {
    expect(classifyRequestError("Invalid criteria count (2) for stage \"Extensive or Overt Signal\"")).toBe("parse_error");
    expect(classifyRequestError("Failed to find RUBRIC block: ...")).toBe("parse_error");
  });
});
