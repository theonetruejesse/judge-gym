import type {
  StageActivityResult,
  WindowStageKey,
} from "@judge-gym/engine-settings/process";
import {
  DEFAULT_ENGINE_SETTINGS,
  classifyTaskFailure,
  resolveAttemptLimitForFailureClass,
} from "@judge-gym/engine-settings";
import {
  abstractPrompt,
  CLEANING_INSTRUCTIONS,
  cleanPrompt,
  NEUTRALIZE_INSTRUCTIONS,
  STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
  neutralizePrompt,
} from "@judge-gym/engine-prompts/window";
import { getConvexWorkerClient, type ConvexWorkerClient } from "../convex/client";
import { estimateTextTokens, getQuotaStore, type QuotaStore } from "../quota";
import { getModelConfig } from "./model_registry";

type ChatResult = {
  assistant_output: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

type SearchResult = {
  title: string;
  url: string;
  raw_content: string;
};

type WindowTransformStage = Exclude<WindowStageKey, "collect">;
const FIRECRAWL_SETTINGS = DEFAULT_ENGINE_SETTINGS.window.firecrawl;
const RETRY_SETTINGS = DEFAULT_ENGINE_SETTINGS.llm.retries;

const WINDOW_STAGE_PROMPTS: Record<
  WindowTransformStage,
  {
    systemPrompt: string;
    buildPrompt: (input: string) => string;
  }
> = {
  l1_cleaned: {
    systemPrompt: CLEANING_INSTRUCTIONS,
    buildPrompt: cleanPrompt,
  },
  l2_neutralized: {
    systemPrompt: NEUTRALIZE_INSTRUCTIONS,
    buildPrompt: neutralizePrompt,
  },
  l3_abstracted: {
    systemPrompt: STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
    buildPrompt: abstractPrompt,
  },
};

function requireOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

export async function searchWindowEvidence(args: {
  query: string;
  country: string;
  start_date: string;
  end_date: string;
  limit: number;
}): Promise<SearchResult[]> {
  const startedAt = Date.now();
  const convex = getConvexWorkerClient();

  console.info("[window.collect] firecrawl search start", {
    query: args.query,
    country: args.country,
    limit: args.limit,
    start_date: args.start_date,
    end_date: args.end_date,
  });

  const items = await convex.searchWindowEvidence(args);
  console.info("[window.collect] firecrawl search finish", {
    query: args.query,
    returned: items.length,
    elapsed_ms: Date.now() - startedAt,
  });
  return items
    .filter(
      (item: any) =>
        typeof item?.raw_content === "string" &&
        item.raw_content.trim().length > 0 &&
        typeof item?.title === "string" &&
        item.title.trim().length > 0 &&
        typeof item?.url === "string" &&
        item.url.trim().length > 0,
    )
    .map((item: any) => ({
      title: item.title as string,
      url: item.url as string,
      raw_content: item.raw_content as string,
    }));
}

export async function runOpenAiChat(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<ChatResult> {
  const { providerModel } = getModelConfig(args.model);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireOpenAiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: providerModel,
      messages: [
        {
          role: "system",
          content: args.systemPrompt,
        },
        {
          role: "user",
          content: args.userPrompt,
        },
      ],
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};

  return {
    assistant_output: body.choices?.[0]?.message?.content ?? "",
    input_tokens: body.usage?.prompt_tokens ?? null,
    output_tokens: body.usage?.completion_tokens ?? null,
    total_tokens: body.usage?.total_tokens ?? null,
  };
}

type WindowStageDependencies = {
  convex: Pick<
    ConvexWorkerClient,
    | "getWindowExecutionContext"
    | "insertWindowEvidenceBatch"
    | "listWindowStageInputs"
    | "recordLlmAttemptStart"
    | "recordLlmAttemptFinish"
    | "applyWindowStageResult"
    | "markWindowStageFailure"
    | "markWindowNoEvidence"
    | "markWindowProcessError"
  >;
  searchWindowEvidence: typeof searchWindowEvidence;
  runOpenAiChat: typeof runOpenAiChat;
  quota: QuotaStore;
};

function getDefaultWindowStageDependencies(): WindowStageDependencies {
  return {
    convex: getConvexWorkerClient(),
    searchWindowEvidence,
    runOpenAiChat,
    quota: getQuotaStore(),
  };
}

function buildObservedDimensions(result: ChatResult) {
  return {
    requests: 1,
    input_tokens: result.input_tokens ?? undefined,
    output_tokens: result.output_tokens ?? undefined,
    total_tokens: result.total_tokens ?? undefined,
  };
}

export async function runWindowStageActivityWithDeps(
  deps: WindowStageDependencies,
  windowRunId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  const { convex } = deps;
  const window = await convex.getWindowExecutionContext(windowRunId);

  if (stage === "collect") {
    let evidences: SearchResult[];
    try {
      evidences = await retryWindowCollectionSearch(deps.searchWindowEvidence, {
        query: window.query,
        country: window.country,
        start_date: window.start_date,
        end_date: window.end_date,
        limit: window.target_count,
      });
    } catch (error) {
      console.error("[window.collect] firecrawl search failed", {
        window_run_id: windowRunId,
        query: window.query,
        country: window.country,
        limit: window.target_count,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (evidences.length === 0) {
      await convex.markWindowNoEvidence({
        window_run_id: windowRunId,
      });
      return {
        processKind: "window",
        processId: windowRunId,
        stage,
        summary: "window_collect:no_evidence",
        haltProcess: true,
        terminalExecutionStatus: "completed",
      };
    }

    const result = await convex.insertWindowEvidenceBatch({
      window_run_id: windowRunId,
      evidences,
    });
    return {
      processKind: "window",
      processId: windowRunId,
      stage,
      summary: `window_collect:inserted=${result.inserted}:total=${result.total}`,
    };
  }

  const stageConfig = WINDOW_STAGE_PROMPTS[stage];
  const inputs = await convex.listWindowStageInputs({
    window_run_id: windowRunId,
    stage,
  });

  if (inputs.length === 0) {
      return {
        processKind: "window",
        processId: windowRunId,
        stage,
        summary: `window_stage:${stage}:noop`,
      };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const item of inputs) {
    const taskResult = await processWindowStageInputWithRetries(deps, {
      windowRunId,
      stage,
      windowModel: window.model,
      workflowId: window.workflow_id ?? `window:${windowRunId}`,
      evidenceId: item.evidence_id,
      evidenceTitle: item.title,
      evidenceUrl: item.url,
      systemPrompt: stageConfig.systemPrompt,
      userPrompt: stageConfig.buildPrompt(item.input),
    });

    if (taskResult === "succeeded") {
      successCount += 1;
    } else {
      failureCount += 1;
    }
  }

  if (successCount === 0 && failureCount > 0) {
    const errorMessage = `All ${stage} attempts failed for window run ${windowRunId}`;
    await convex.markWindowProcessError({
      window_run_id: windowRunId,
      stage,
      error_message: errorMessage,
    });
    return {
      processKind: "window",
      processId: windowRunId,
      stage,
      summary: `window_stage:${stage}:failed=${failureCount}`,
      haltProcess: true,
      terminalExecutionStatus: "failed",
      errorMessage,
    };
  }

  return {
    processKind: "window",
    processId: windowRunId,
    stage,
    summary: `window_stage:${stage}:success=${successCount}:failed=${failureCount}`,
  };
}

export async function runWindowStageActivity(
  windowRunId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  return runWindowStageActivityWithDeps(
    getDefaultWindowStageDependencies(),
    windowRunId,
    stage,
  );
}

async function processWindowStageInputWithRetries(
  deps: WindowStageDependencies,
  args: {
    windowRunId: string;
    stage: WindowTransformStage;
    windowModel: string;
    workflowId: string;
    evidenceId: string;
    evidenceTitle: string;
    evidenceUrl: string;
    systemPrompt: string;
    userPrompt: string;
  },
): Promise<"succeeded" | "failed"> {
  const { provider } = getModelConfig(args.windowModel);
  let maxAttempts = RETRY_SETTINGS.unexpectedFailureMaxAttempts;
  let attempt = 0;
  let lastFailure:
    | {
        attemptId: string;
        message: string;
      }
    | null = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    const { attempt_id } = await deps.convex.recordLlmAttemptStart({
      process_kind: "window",
      process_id: args.windowRunId,
      target_type: "evidence",
      target_id: args.evidenceId,
      stage: args.stage,
      provider,
      model: args.windowModel,
      operation_type: "chat",
      workflow_id: args.workflowId,
      system_prompt: args.systemPrompt,
      user_prompt: args.userPrompt,
      metadata_json: JSON.stringify({
        evidence_title: args.evidenceTitle,
        evidence_url: args.evidenceUrl,
      }),
    });
    const reservedDimensions = {
      requests: 1,
      input_tokens:
        estimateTextTokens(args.systemPrompt) + estimateTextTokens(args.userPrompt),
      total_tokens:
        estimateTextTokens(args.systemPrompt) + estimateTextTokens(args.userPrompt),
    };
    const reservation = await deps.quota.reserve({
      reservationId:
        `window:${args.windowRunId}:${args.stage}:${args.evidenceId}:${attempt_id}`,
      provider,
      model: args.windowModel,
      operationType: "chat",
      scopeKey: `window:${args.windowRunId}:${args.stage}`,
      dimensions: reservedDimensions,
      processKind: "window",
      processId: args.windowRunId,
      workflowId: args.workflowId,
    });

    try {
      if (!reservation.allowed) {
        throw new Error(
          `Quota reservation denied for ${args.stage}: ${reservation.reason ?? "quota_denied"}`,
        );
      }

      const result = await deps.runOpenAiChat({
        model: args.windowModel,
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
      });
      await deps.convex.applyWindowStageResult({
        window_run_id: args.windowRunId,
        evidence_id: args.evidenceId,
        stage: args.stage,
        attempt_id,
        output: result.assistant_output,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        total_tokens: result.total_tokens,
      });
      await deps.convex.recordLlmAttemptFinish({
        attempt_id,
        status: "succeeded",
        assistant_output: result.assistant_output,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        total_tokens: result.total_tokens,
      });
      await deps.quota.settle({
        reservationId: reservation.reservationId,
        provider,
        model: args.windowModel,
        operationType: "chat",
        scopeKey: `window:${args.windowRunId}:${args.stage}`,
        reserved: reservedDimensions,
        observed: buildObservedDimensions(result),
        status: "applied",
      });
      return "succeeded";
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (reservation.allowed) {
        await deps.quota.settle({
          reservationId: reservation.reservationId,
          provider,
          model: args.windowModel,
          operationType: "chat",
          scopeKey: `window:${args.windowRunId}:${args.stage}`,
          reserved: reservedDimensions,
          observed: { requests: 1 },
          status: "failed",
        });
      }
      await deps.convex.recordLlmAttemptFinish({
        attempt_id,
        status: "failed",
        error_message: message,
      });
      lastFailure = {
        attemptId: attempt_id,
        message,
      };
      const failureClass = classifyTaskFailure(error);
      maxAttempts = resolveAttemptLimitForFailureClass(
        failureClass,
        RETRY_SETTINGS,
      );
      if (attempt < maxAttempts) {
        await sleep(RETRY_SETTINGS.backoffMs);
        continue;
      }
    }
  }

  if (!lastFailure) {
    throw new Error("Window stage failed without an attempt record");
  }

  await deps.convex.markWindowStageFailure({
    window_run_id: args.windowRunId,
    evidence_id: args.evidenceId,
    stage: args.stage,
    attempt_id: lastFailure.attemptId,
    error_message: lastFailure.message,
  });
  return "failed";
}

async function retryWindowCollectionSearch(
  search: typeof searchWindowEvidence,
  args: {
    query: string;
    country: string;
    start_date: string;
    end_date: string;
    limit: number;
  },
): Promise<SearchResult[]> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= FIRECRAWL_SETTINGS.maxAttempts; attempt += 1) {
    try {
      return await search(args);
    } catch (error) {
      lastError = error;
      if (attempt >= FIRECRAWL_SETTINGS.maxAttempts) {
        break;
      }
      await sleep(FIRECRAWL_SETTINGS.retryBackoffMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "Window collection failed"));
}

async function sleep(ms: number) {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}
