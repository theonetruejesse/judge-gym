import type { ProcessKind } from "./process";

export const QUOTA_DIMENSIONS = [
  "requests",
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "batch_enqueued_input_tokens",
] as const;
export type QuotaDimension = (typeof QUOTA_DIMENSIONS)[number];

export interface QuotaDimensions {
  requests?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  batch_enqueued_input_tokens?: number;
}

export interface QuotaReservationInput {
  reservationId: string;
  provider: string;
  model?: string;
  operationType: string;
  scopeKey: string;
  dimensions: QuotaDimensions;
  processKind?: ProcessKind;
  processId?: string;
  workflowId?: string;
}

export interface QuotaReservationResult {
  allowed: boolean;
  reservationId: string;
  bucketKeys: string[];
  dimensions: QuotaDimensions;
  reason?: string;
}

export interface QuotaSettlementInput {
  reservationId: string;
  provider: string;
  model?: string;
  operationType: string;
  scopeKey: string;
  reserved: QuotaDimensions;
  observed?: QuotaDimensions;
  status: "applied" | "refunded" | "failed";
}
