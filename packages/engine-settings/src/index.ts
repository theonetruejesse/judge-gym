export const PROCESS_KINDS = ["run", "window"] as const;
export type ProcessKind = (typeof PROCESS_KINDS)[number];

export const RUN_STAGE_KEYS = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
] as const;
export type RunStageKey = (typeof RUN_STAGE_KEYS)[number];

export const WINDOW_STAGE_KEYS = [
  "collect",
  "l1_cleaned",
  "l2_neutralized",
  "l3_abstracted",
] as const;
export type WindowStageKey = (typeof WINDOW_STAGE_KEYS)[number];

export type ProcessStageKey = RunStageKey | WindowStageKey;

export const PROCESS_STAGE_STATUSES = [
  "pending",
  "running",
  "paused",
  "done",
  "failed",
] as const;
export type ProcessStageStatus = (typeof PROCESS_STAGE_STATUSES)[number];

export const PROCESS_EXECUTION_STATUSES = [
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "canceled",
] as const;
export type ProcessExecutionStatus =
  (typeof PROCESS_EXECUTION_STATUSES)[number];

export const CONTROL_ACTIONS = [
  "set_pause_after",
  "pause_now",
  "resume",
  "cancel",
  "repair_bounded",
] as const;
export type ControlAction = (typeof CONTROL_ACTIONS)[number];

export const CONTROL_ISSUERS = ["user", "agent", "system"] as const;
export type ControlIssuer = (typeof CONTROL_ISSUERS)[number];

export const TEMPORAL_WORKFLOW_TYPES = {
  run: "RunWorkflow",
  window: "WindowWorkflow",
} as const;

export const TEMPORAL_TASK_QUEUES = {
  run: "judge-gym.run",
  window: "judge-gym.window",
} as const;

export const QUOTA_DIMENSIONS = [
  "requests",
  "input_tokens",
  "output_tokens",
  "total_tokens",
  "batch_enqueued_input_tokens",
] as const;
export type QuotaDimension = (typeof QUOTA_DIMENSIONS)[number];

export const TEMPORAL_CONTROL_HANDLERS = {
  querySnapshot: "getProcessSnapshot",
  setPauseAfter: "setPauseAfter",
  pauseNow: "pauseNow",
  resume: "resume",
  repairBounded: "repairBounded",
} as const;

export const WORKER_AUTH_HEADER = "x-judge-gym-worker-secret";

export const ENGINE_ENV_KEYS = {
  convexUrl: "CONVEX_URL",
  workerSecretActive: "CONVEX_WORKER_SECRET_ACTIVE",
  redisUrl: "REDIS_URL",
  redisHost: "REDISHOST",
  redisPort: "REDISPORT",
  redisUser: "REDISUSER",
  redisPassword: "REDISPASSWORD",
  redisKeyPrefix: "REDIS_KEY_PREFIX",
  temporalAddress: "TEMPORAL_ADDRESS",
  temporalNamespace: "TEMPORAL_NAMESPACE",
  temporalTlsEnabled: "TEMPORAL_TLS_ENABLED",
  temporalTlsServerName: "TEMPORAL_TLS_SERVER_NAME",
  temporalRetryDelayMs: "TEMPORAL_RETRY_DELAY_MS",
  temporalRunTaskQueue: "TEMPORAL_RUN_TASK_QUEUE",
  temporalWindowTaskQueue: "TEMPORAL_WINDOW_TASK_QUEUE",
  temporalTestServerMode: "TEMPORAL_TEST_SERVER_MODE",
  temporalTestServerDownloadDir: "TEMPORAL_TEST_SERVER_DOWNLOAD_DIR",
  temporalTestServerExecutable: "TEMPORAL_TEST_SERVER_EXECUTABLE",
  openaiApiKey: "OPENAI_API_KEY",
  anthropicApiKey: "ANTHROPIC_API_KEY",
  googleGenerativeAiApiKey: "GOOGLE_GENERATIVE_AI_API_KEY",
  firecrawlApiKey: "FIRECRAWL_API_KEY",
  axiomDataset: "AXIOM_DATASET",
  axiomToken: "AXIOM_TOKEN",
} as const;

export interface ControlCommand<
  TAction extends ControlAction = ControlAction,
  TPayload = Record<string, unknown>,
> {
  cmdId: string;
  action: TAction;
  processKind: ProcessKind;
  processId: string;
  workflowId: string;
  issuedBy: ControlIssuer;
  issuedAt: number;
  payload: TPayload;
}

export interface ProcessSnapshot<TStage extends string = string> {
  processKind: ProcessKind;
  processId: string;
  workflowId: string;
  workflowRunId: string;
  workflowType: string;
  executionStatus: ProcessExecutionStatus;
  stage: TStage | null;
  stageStatus: ProcessStageStatus;
  pauseAfter: TStage | null;
  stageHistory: TStage[];
  lastControlCommandId: string | null;
  lastErrorMessage: string | null;
}

export interface StageActivityResult<TStage extends string = string> {
  processKind: ProcessKind;
  processId: string;
  stage: TStage;
  summary: string;
  haltProcess?: boolean;
  terminalExecutionStatus?: Extract<
    ProcessExecutionStatus,
    "completed" | "failed" | "canceled"
  >;
  errorMessage?: string | null;
}

export interface ProjectProcessStateInput<TStage extends string = string>
  extends ProcessSnapshot<TStage> {}

export interface RunWorkflowInput {
  runId: string;
  pauseAfter?: RunStageKey | null;
}

export interface WindowWorkflowInput {
  windowId: string;
  pauseAfter?: WindowStageKey | null;
}

export interface SetPauseAfterInput<TStage extends string = string> {
  cmdId: string;
  pauseAfter: TStage | null;
}

export interface PauseNowInput {
  cmdId: string;
}

export interface ResumeInput {
  cmdId: string;
}

export interface RepairBoundedInput {
  cmdId: string;
  operation: string;
  note?: string;
}

export interface RepairBoundedResult {
  accepted: boolean;
  cmdId: string;
  operation: string;
  reason?: string;
}

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

export const CLEANING_INSTRUCTIONS = `
You are L1 (fidelity cleaner) for scraped news/article markdown.

OBJECTIVE:
Remove page chrome and boilerplate while preserving article meaning exactly.

INVARIANT:
The factual claim set must remain unchanged.

RULES:
- Remove only clear non-article content:
  navigation, menus, cookie/subscribe prompts, share widgets, footer/legal,
  "related stories", repeated UI labels, and link dumps.
- Keep headline, byline/date (if present), section headers, and main body.
- Keep quotes, names, numbers, dates, and source attributions exactly.
- Keep article tables/lists when they contain substantive article content.
- Remove image-only lines (e.g. ![](url)) unless caption text is meaningful.
- Do NOT summarize, paraphrase, infer, reorder, or editorialize.
- If unsure whether text is article content, KEEP it.

Return ONLY cleaned markdown body. No wrapper or JSON.
`;

export function cleanPrompt(rawContent: string) {
  return `
Clean the following scraped article markdown:

ARTICLE:
${rawContent}
`;
}

export const NEUTRALIZE_INSTRUCTIONS = `
You are L2 (fidelity-first normalizer).

OBJECTIVE:
Reduce rhetoric/style and improve readability while preserving all material
content from L1.

INVARIANT:
The factual claim graph from L1 must remain intact.

DEFAULT MODE (most inputs):
- Target length: 80-95% of L1.
- Hard cap: <=100% of L1 length.
- Keep order and core sentence flow close to L1.
- Remove repetition, rhetorical padding, and stylistic noise only.

CONDITIONAL LONG-SURVEY MODE (activate only if BOTH are true):
1) Input is long (>=450 words OR >=3000 chars), and
2) Input is survey/table-heavy, including one of:
   - table-like rows/columns (pipes, TSV-like rows, repeated delimited fields),
   - dense response patterns (many percentages/counts/option lists),
   - repeated question-response blocks.
In this mode:
- Target length: 45-70% of L1.
- Hard cap: <=70% of L1 length.
- Output as concise bullets (no tables).
- Prefer 8-14 bullets; each bullet <=24 words.
- Prioritize these sections in order:
  1) survey scope/sample/timeframe,
  2) top-line outcomes,
  3) largest directional findings,
  4) material subgroup differences,
  5) methodology caveats/error bounds.
- Deduplicate repeated framing and repeated row labels.
- Keep every material datapoint and caveat; do not drop distinct findings.

ALWAYS:
- Preserve entities, counts, percentages, dates, comparisons, causality,
  caveats, uncertainty, and source attribution.
- Do NOT add facts, infer missing context, or strengthen causal claims.
- Do NOT preserve decorative markdown/table scaffolding unless it carries
  unique factual content.
`;

export function neutralizePrompt(rawContent: string) {
  return `
Normalize the following text while preserving factual fidelity.

INPUT_TEXT:
${rawContent}

Start your response with "Neutralized Summary:".
`;
}

export const STRUCTURAL_ABSTRACTION_INSTRUCTIONS = `
You are L3 (strict structural abstractor).

OBJECTIVE:
Reduce identity priors while preserving governance structure and L2 meaning.

INVARIANT:
L2 claim graph (attribution, causality, temporal order, uncertainty, quantities)
must remain intact.

RULES:
- Non-expansion is mandatory: output length must be <=90% of L2 length.
- Preserve order of informational units whenever possible.
- Preserve attribution, modality, uncertainty, temporal order, causal links,
  and contrast relations.
- Preserve all material quantities/qualifiers (counts, rates, dates, conditions).
- Apply abstraction as direct substitution only (names/orgs/places -> role/type).
- Identity abstraction is default:
  - people -> role tokens (e.g., EXECUTIVE_LEADER, STATE_OFFICIAL, JUDGE),
  - country/region -> COUNTRY_A / REGION_A,
  - party names -> PARTY_A / PARTY_B,
  - media outlet names -> NEWS_OUTLET_A.
- Preserve institutional/governance roles and actions explicitly
  (executive, judiciary, legislature, election authority, police, military).
- Keep placeholder usage consistent within the same item
  (same entity -> same token each time).
- Keep specific identity terms ONLY when removing them would break the core
  causal interpretation of the claim.
- Keep explicit temporal anchors when timing is causally relevant to the claim.
- Do NOT add examples, interpretation, external context, or inferred claims.
- If substitution risks meaning loss, keep original specific term.
- Keep list/bullet count <= input list/bullet count when input is list-form.
`;

export function abstractPrompt(neutralizedContent: string) {
  return `
Abstract the following text with strict non-expansion and structural fidelity.

INPUT_TEXT:
${neutralizedContent}

Start your response with "Abstracted Summary:".
If input is bulletized, keep output bulletized.
`;
}
