import type {
  QuotaDimension,
  QuotaDimensions,
  QuotaReservationInput,
  QuotaReservationResult,
  QuotaSettlementInput,
} from "@judge-gym/engine-settings";

export type QuotaBucketScope = "provider" | "model" | "scope";

export interface QuotaBucketRef {
  dimension: QuotaDimension;
  key: string;
  scope: QuotaBucketScope;
}

export interface UpstashQuotaRuntimeConfig {
  enabled: boolean;
  url: string | null;
  token: string | null;
  keyPrefix: string;
}

export interface QuotaPlan {
  reservationId: string;
  reserved: QuotaDimensions;
  buckets: QuotaBucketRef[];
}

export interface QuotaStore {
  reserve(input: QuotaReservationInput): Promise<QuotaReservationResult>;
  settle(input: QuotaSettlementInput): Promise<void>;
}
