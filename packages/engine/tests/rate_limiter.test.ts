import { describe, expect, test } from "bun:test";
import {
  INPUT_TOKEN_LIMIT_KEYS,
  OUTPUT_TOKEN_LIMIT_KEYS,
  RATE_LIMIT_CONFIGS,
  RATE_LIMITED_MODEL_LIST,
  REQUEST_LIMIT_KEYS,
} from "../convex/platform/rate_limiter";
import { calculateRateLimit } from "@convex-dev/rate-limiter";

describe("rate limiter config", () => {
  test("active models have request/input/output buckets", () => {
    if (RATE_LIMITED_MODEL_LIST.length === 0) {
      expect(RATE_LIMITED_MODEL_LIST.length).toBe(0);
      return;
    }

    for (const model of RATE_LIMITED_MODEL_LIST) {
      const requestKey = REQUEST_LIMIT_KEYS[model];
      const inputKey = INPUT_TOKEN_LIMIT_KEYS[model];
      const outputKey = OUTPUT_TOKEN_LIMIT_KEYS[model];

      expect(RATE_LIMIT_CONFIGS[requestKey]).toBeDefined();
      expect(RATE_LIMIT_CONFIGS[inputKey]).toBeDefined();
      expect(RATE_LIMIT_CONFIGS[outputKey]).toBeDefined();
    }
  });

  test("token bucket configs enforce capacity", () => {
    if (RATE_LIMITED_MODEL_LIST.length === 0) {
      expect(RATE_LIMITED_MODEL_LIST.length).toBe(0);
      return;
    }

    const model = RATE_LIMITED_MODEL_LIST[0];
    const requestKey = REQUEST_LIMIT_KEYS[model];
    const config = RATE_LIMIT_CONFIGS[requestKey];

    expect(config.kind).toBe("token bucket");

    const max = config.capacity ?? config.rate;
    const result = calculateRateLimit(null, config, 0, max + 1);

    expect(result.value).toBeLessThan(0);
    expect(result.retryAfter).toBeGreaterThan(0);
  });
});
