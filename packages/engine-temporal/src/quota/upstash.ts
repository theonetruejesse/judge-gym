import { Redis } from "@upstash/redis";
import type {
  QuotaDimension,
  QuotaDimensions,
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
} from "@judge-gym/engine-settings";
import { QUOTA_DIMENSIONS } from "@judge-gym/engine-settings";
import { getUpstashQuotaRuntimeConfig } from "./runtime";
import type { QuotaBucketRef, QuotaStore } from "./types";

let cachedRedis: Redis | null = null;

function getActiveDimensions(
  dimensions: QuotaDimensions,
): QuotaDimension[] {
  return QUOTA_DIMENSIONS.filter((dimension) => {
    const value = dimensions[dimension];
    return typeof value === "number" && value > 0;
  });
}

export function buildQuotaBucketRefs(
  input: Pick<
    QuotaReservationInput,
    "provider" | "model" | "operationType" | "scopeKey" | "dimensions"
  >,
  keyPrefix = getUpstashQuotaRuntimeConfig().keyPrefix,
): QuotaBucketRef[] {
  const dimensions = getActiveDimensions(input.dimensions);

  return dimensions.flatMap((dimension) => {
    const providerKey = [
      keyPrefix,
      input.provider,
      "provider",
      dimension,
      input.operationType,
    ].join(":");
    const scopedKey = [
      keyPrefix,
      input.provider,
      "scope",
      input.scopeKey,
      dimension,
      input.operationType,
    ].join(":");

    const refs: QuotaBucketRef[] = [
      {
        dimension,
        key: providerKey,
        scope: "provider",
      },
      {
        dimension,
        key: scopedKey,
        scope: "scope",
      },
    ];

    if (input.model) {
      refs.push({
        dimension,
        key: [
          keyPrefix,
          input.provider,
          "model",
          input.model,
          dimension,
          input.operationType,
        ].join(":"),
        scope: "model",
      });
    }

    return refs;
  });
}

export function getUpstashRedisClient() {
  if (cachedRedis) {
    return cachedRedis;
  }

  const config = getUpstashQuotaRuntimeConfig();
  if (!config.url || !config.token) {
    throw new Error(
      "Upstash Redis is not configured. Expected UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }

  cachedRedis = new Redis({
    url: config.url,
    token: config.token,
  });
  return cachedRedis;
}

export class UpstashQuotaStore implements QuotaStore {
  async reserve(
    input: QuotaReservationInput,
  ): Promise<QuotaReservationResult> {
    const config = getUpstashQuotaRuntimeConfig();
    const bucketRefs = buildQuotaBucketRefs(input, config.keyPrefix);

    if (!config.enabled) {
      return {
        allowed: true,
        reservationId: input.reservationId,
        bucketKeys: bucketRefs.map((ref) => ref.key),
        dimensions: input.dimensions,
        reason: "upstash_not_configured",
      };
    }

    getUpstashRedisClient();
    return {
      allowed: true,
      reservationId: input.reservationId,
      bucketKeys: bucketRefs.map((ref) => ref.key),
      dimensions: input.dimensions,
    };
  }

  async settle(_input: QuotaSettlementInput): Promise<void> {
    if (!getUpstashQuotaRuntimeConfig().enabled) {
      return;
    }

    getUpstashRedisClient();
  }
}
