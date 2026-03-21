import type {
  QuotaDimension,
  QuotaDimensions,
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
} from "@judge-gym/engine-settings/quota";

export type QuotaBucketScope = "provider" | "model" | "scope";

export interface QuotaBucketRef {
  dimension: QuotaDimension;
  key: string;
  scope: QuotaBucketScope;
}

export interface TokenBucketPolicy {
  rate: number;
  periodMs: number;
  capacity: number;
}

export interface QuotaBucketPlan extends QuotaBucketRef {
  amount: number;
  policy: TokenBucketPolicy;
}

export interface RedisQuotaRuntimeConfig {
  enabled: boolean;
  url: string | null;
  keyPrefix: string;
}

export interface QuotaPlan {
  reservationId: string;
  reserved: QuotaDimensions;
  buckets: QuotaBucketPlan[];
}

export interface QuotaStore {
  reserve(input: QuotaReservationInput): Promise<QuotaReservationResult>;
  settle(input: QuotaSettlementInput): Promise<void>;
}
