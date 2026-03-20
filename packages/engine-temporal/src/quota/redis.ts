import { createClient } from "redis";
import type {
  QuotaDimension,
  QuotaDimensions,
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
} from "@judge-gym/engine-settings";
import { QUOTA_DIMENSIONS } from "@judge-gym/engine-settings";
import { buildQuotaBucketPlans as buildQuotaPlansFromPolicy } from "./policies";
import { getRedisQuotaRuntimeConfig } from "./runtime";
import type {
  QuotaBucketPlan,
  QuotaBucketRef,
  QuotaStore,
} from "./types";

type RedisEvalOptions = {
  keys: string[];
  arguments: string[];
};

interface RedisClient {
  isOpen: boolean;
  connect(): Promise<void>;
  eval(script: string, options: RedisEvalOptions): Promise<unknown>;
  on(event: "error", listener: (error: unknown) => void): this;
}

let cachedRedis: RedisClient | null = null;
let redisConnectPromise: Promise<RedisClient> | null = null;
let cachedQuotaStore: RedisQuotaStore | null = null;

const RESERVATION_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

const RESERVE_SCRIPT = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local recordTtl = tonumber(ARGV[3])
local reservationKey = KEYS[1]
if redis.call("GET", reservationKey) then
  return {"duplicate", "0"}
end

local states = {}
local argIndex = 4
local maxRetry = 0
for i = 2, #KEYS do
  local key = KEYS[i]
  local amount = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local rate = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local period = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local capacity = tonumber(ARGV[argIndex]); argIndex = argIndex + 1

  local tokens = capacity
  local updatedAt = now
  local raw = redis.call("GET", key)
  if raw then
    local sep = string.find(raw, ":")
    if sep then
      tokens = tonumber(string.sub(raw, 1, sep - 1)) or capacity
      updatedAt = tonumber(string.sub(raw, sep + 1)) or now
    end
    if updatedAt > now then
      updatedAt = now
    end
    local elapsed = now - updatedAt
    if elapsed > 0 then
      tokens = math.min(capacity, tokens + ((elapsed * rate) / period))
    end
  end

  if amount > 0 and tokens < amount then
    local deficit = amount - tokens
    local retryAfter = math.ceil((deficit * period) / rate)
    if retryAfter > maxRetry then
      maxRetry = retryAfter
    end
    return {"denied", tostring(maxRetry)}
  end

  states[i - 1] = { key, tokens - amount }
end

for _, state in ipairs(states) do
  redis.call("SET", state[1], tostring(state[2]) .. ":" .. tostring(now), "PX", ttl)
end
redis.call("SET", reservationKey, "reserved", "PX", recordTtl)
return {"allowed", "0"}
`;

const SETTLE_SCRIPT = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local recordTtl = tonumber(ARGV[3])
local terminalStatus = ARGV[4]
local reservationKey = KEYS[1]
local reservationState = redis.call("GET", reservationKey)
if not reservationState then
  return {"missing"}
end
if reservationState ~= "reserved" then
  return {"duplicate"}
end

local argIndex = 5
for i = 2, #KEYS do
  local key = KEYS[i]
  local delta = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local rate = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local period = tonumber(ARGV[argIndex]); argIndex = argIndex + 1
  local capacity = tonumber(ARGV[argIndex]); argIndex = argIndex + 1

  local tokens = capacity
  local updatedAt = now
  local raw = redis.call("GET", key)
  if raw then
    local sep = string.find(raw, ":")
    if sep then
      tokens = tonumber(string.sub(raw, 1, sep - 1)) or capacity
      updatedAt = tonumber(string.sub(raw, sep + 1)) or now
    end
    if updatedAt > now then
      updatedAt = now
    end
    local elapsed = now - updatedAt
    if elapsed > 0 then
      tokens = math.min(capacity, tokens + ((elapsed * rate) / period))
    end
  end

  if delta ~= 0 then
    tokens = tokens - delta
    if tokens > capacity then
      tokens = capacity
    end
    redis.call("SET", key, tostring(tokens) .. ":" .. tostring(now), "PX", ttl)
  end
end

redis.call("SET", reservationKey, "settled:" .. terminalStatus, "PX", recordTtl)
return {"settled"}
`;

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
  keyPrefix = getRedisQuotaRuntimeConfig().keyPrefix,
): QuotaBucketRef[] {
  const dimensions = getActiveDimensions(input.dimensions);

  return dimensions.flatMap((dimension) => {
    const refs: QuotaBucketRef[] = [
      {
        dimension,
        key: [
          keyPrefix,
          input.provider,
          "provider",
          dimension,
          input.operationType,
        ].join(":"),
        scope: "provider",
      },
      {
        dimension,
        key: [
          keyPrefix,
          input.provider,
          "scope",
          input.scopeKey,
          dimension,
          input.operationType,
        ].join(":"),
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

function buildResolvedQuotaBucketPlans(
  input: Pick<
    QuotaReservationInput,
    "provider" | "model" | "operationType" | "scopeKey" | "dimensions"
  >,
  keyPrefix = getRedisQuotaRuntimeConfig().keyPrefix,
): QuotaBucketPlan[] {
  return buildQuotaPlansFromRefs(
    buildQuotaBucketRefs(input, keyPrefix),
    input,
  );
}

function buildQuotaPlansFromRefs(
  refs: QuotaBucketRef[],
  input: Pick<QuotaReservationInput, "provider" | "model" | "dimensions">,
): QuotaBucketPlan[] {
  return buildQuotaPlansFromPolicy(refs, input);
}

function reservationRecordKey(
  reservationId: string,
  keyPrefix = getRedisQuotaRuntimeConfig().keyPrefix,
) {
  return [keyPrefix, "reservation", reservationId].join(":");
}

function maxBucketTtlMs(plans: QuotaBucketPlan[]) {
  return plans.reduce(
    (max, plan) => Math.max(max, plan.policy.periodMs * 2),
    60_000,
  );
}

function parseScriptResponse(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }
  return [String(raw)];
}

function toObservedTargetDimensions(
  input: QuotaSettlementInput,
): QuotaDimensions {
  if (input.status === "refunded") {
    return {};
  }

  if (input.observed) {
    return input.observed;
  }

  if (input.status === "failed") {
    return {
      requests: input.reserved.requests,
    };
  }

  return input.reserved;
}

function diffDimensions(
  reserved: QuotaDimensions,
  target: QuotaDimensions,
): QuotaDimensions {
  const delta: QuotaDimensions = {};
  for (const dimension of QUOTA_DIMENSIONS) {
    const reservedValue = reserved[dimension] ?? 0;
    const targetValue = target[dimension] ?? 0;
    const next = targetValue - reservedValue;
    if (next !== 0) {
      delta[dimension] = next;
    }
  }
  return delta;
}

export function estimateTextTokens(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  return Math.ceil(trimmed.length / 4);
}

export async function getRedisClient() {
  if (cachedRedis?.isOpen) {
    return cachedRedis;
  }

  if (redisConnectPromise) {
    return redisConnectPromise;
  }

  const config = getRedisQuotaRuntimeConfig();
  if (!config.url) {
    throw new Error(
      "Redis is not configured. Expected REDIS_URL or REDISHOST/REDISPORT.",
    );
  }

  const client = createClient({
    url: config.url,
    socket: {
      reconnectStrategy(retries) {
        return Math.min(retries * 50, 1_000);
      },
    },
  }) as unknown as RedisClient;
  client.on("error", () => {
    // Keep connection noise out of the steady-state worker logs.
  });

  redisConnectPromise = client.connect().then(() => {
    cachedRedis = client;
    return client;
  }).finally(() => {
    redisConnectPromise = null;
  });

  return redisConnectPromise;
}

export function getQuotaStore() {
  cachedQuotaStore ??= new RedisQuotaStore();
  return cachedQuotaStore;
}

export class RedisQuotaStore implements QuotaStore {
  constructor(
    private readonly getClient: () => Promise<RedisClient> = getRedisClient,
  ) {}

  async reserve(
    input: QuotaReservationInput,
  ): Promise<QuotaReservationResult> {
    const config = getRedisQuotaRuntimeConfig();
    const bucketPlans = buildResolvedQuotaBucketPlans(input, config.keyPrefix);

    if (!config.enabled) {
      return {
        allowed: true,
        reservationId: input.reservationId,
        bucketKeys: bucketPlans.map((plan) => plan.key),
        dimensions: input.dimensions,
        reason: "redis_not_configured",
      };
    }

    if (bucketPlans.length === 0) {
      return {
        allowed: true,
        reservationId: input.reservationId,
        bucketKeys: [],
        dimensions: input.dimensions,
        reason: "no_quota_policies",
      };
    }

    const redis = await this.getClient();
    const reservationKey = reservationRecordKey(
      input.reservationId,
      config.keyPrefix,
    );
    const keys = [reservationKey, ...bucketPlans.map((plan) => plan.key)];
    const args = [
      String(Date.now()),
      String(maxBucketTtlMs(bucketPlans)),
      String(RESERVATION_RECORD_TTL_MS),
      ...bucketPlans.flatMap((plan) => [
        String(plan.amount),
        String(plan.policy.rate),
        String(plan.policy.periodMs),
        String(plan.policy.capacity),
      ]),
    ];
    const [status, detail] = parseScriptResponse(
      await redis.eval(RESERVE_SCRIPT, {
        keys,
        arguments: args,
      }),
    );

    if (status === "allowed" || status === "duplicate") {
      return {
        allowed: true,
        reservationId: input.reservationId,
        bucketKeys: bucketPlans.map((plan) => plan.key),
        dimensions: input.dimensions,
        reason: status === "duplicate" ? "duplicate_reservation" : undefined,
      };
    }

    return {
      allowed: false,
      reservationId: input.reservationId,
      bucketKeys: bucketPlans.map((plan) => plan.key),
      dimensions: input.dimensions,
      reason: detail ? `quota_denied:${detail}` : "quota_denied",
    };
  }

  async settle(input: QuotaSettlementInput): Promise<void> {
    const config = getRedisQuotaRuntimeConfig();
    if (!config.enabled) {
      return;
    }

    const targetDimensions = toObservedTargetDimensions(input);
    const deltaDimensions = diffDimensions(input.reserved, targetDimensions);
    const bucketPlans = buildResolvedQuotaBucketPlans(
      {
        provider: input.provider,
        model: input.model,
        operationType: input.operationType,
        scopeKey: input.scopeKey,
        dimensions: input.reserved,
      },
      config.keyPrefix,
    );

    if (bucketPlans.length === 0) {
      return;
    }

    const redis = await this.getClient();
    const reservationKey = reservationRecordKey(
      input.reservationId,
      config.keyPrefix,
    );
    const keys = [reservationKey, ...bucketPlans.map((plan) => plan.key)];
    const args = [
      String(Date.now()),
      String(maxBucketTtlMs(bucketPlans)),
      String(RESERVATION_RECORD_TTL_MS),
      input.status,
      ...bucketPlans.flatMap((plan) => [
        String(deltaDimensions[plan.dimension] ?? 0),
        String(plan.policy.rate),
        String(plan.policy.periodMs),
        String(plan.policy.capacity),
      ]),
    ];

    await redis.eval(SETTLE_SCRIPT, {
      keys,
      arguments: args,
    });
  }
}
