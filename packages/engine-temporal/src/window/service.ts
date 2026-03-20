import Firecrawl from "@mendable/firecrawl-js";
import {
  abstractPrompt,
  CLEANING_INSTRUCTIONS,
  cleanPrompt,
  NEUTRALIZE_INSTRUCTIONS,
  STRUCTURAL_ABSTRACTION_INSTRUCTIONS,
  type StageActivityResult,
  type WindowStageKey,
  neutralizePrompt,
} from "@judge-gym/engine-settings";
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

function requireFirecrawlKey() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error("FIRECRAWL_API_KEY is not set");
  }
  return key;
}

function requireOpenAiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

function toSearchDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

export async function searchWindowEvidence(args: {
  query: string;
  country: string;
  start_date: string;
  end_date: string;
  limit: number;
}): Promise<SearchResult[]> {
  const firecrawl = new Firecrawl({
    apiKey: requireFirecrawlKey(),
  });

  const response = await firecrawl.search(
    `${args.query} ${args.country} news articles`,
    {
      limit: args.limit,
      sources: ["news"],
      location: args.country,
      tbs: `cdr:1,cd_min:${toSearchDate(args.start_date)},cd_max:${toSearchDate(args.end_date)}`,
      scrapeOptions: {
        formats: ["markdown"],
      },
    },
  );

  const items = response?.news ?? [];
  return items
    .filter(
      (item: any) =>
        typeof item?.markdown === "string" &&
        item.markdown.trim().length > 0 &&
        typeof item?.title === "string" &&
        item.title.trim().length > 0 &&
        typeof item?.url === "string" &&
        item.url.trim().length > 0,
    )
    .map((item: any) => ({
      title: item.title as string,
      url: item.url as string,
      raw_content: item.markdown as string,
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
  windowId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  const { convex } = deps;
  const window = await convex.getWindowExecutionContext(windowId);

  if (stage === "collect") {
    const evidences = await deps.searchWindowEvidence({
      query: window.query,
      country: window.country,
      start_date: window.start_date,
      end_date: window.end_date,
      limit: window.target_count,
    });

    if (evidences.length === 0) {
      await convex.markWindowNoEvidence({
        window_id: windowId,
      });
      return {
        processKind: "window",
        processId: windowId,
        stage,
        summary: "window_collect:no_evidence",
        haltProcess: true,
        terminalExecutionStatus: "completed",
      };
    }

    const result = await convex.insertWindowEvidenceBatch({
      window_id: windowId,
      evidences,
    });
    return {
      processKind: "window",
      processId: windowId,
      stage,
      summary: `window_collect:inserted=${result.inserted}:total=${result.total}`,
    };
  }

  const stageConfig = WINDOW_STAGE_PROMPTS[stage];
  const inputs = await convex.listWindowStageInputs({
    window_id: windowId,
    stage,
  });

  if (inputs.length === 0) {
    return {
      processKind: "window",
      processId: windowId,
      stage,
      summary: `window_stage:${stage}:noop`,
    };
  }

  let successCount = 0;
  let failureCount = 0;

  for (const item of inputs) {
    const systemPrompt = stageConfig.systemPrompt;
    const userPrompt = stageConfig.buildPrompt(item.input);
    const { provider } = getModelConfig(window.model);
    const workflowId = window.workflow_id ?? `window:${windowId}`;

    const { attempt_id } = await convex.recordLlmAttemptStart({
      process_kind: "window",
      process_id: windowId,
      target_type: "evidence",
      target_id: item.evidence_id,
      stage,
      provider,
      model: window.model,
      operation_type: "chat",
      workflow_id: workflowId,
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      metadata_json: JSON.stringify({
        evidence_title: item.title,
        evidence_url: item.url,
      }),
    });
    const reservedDimensions = {
      requests: 1,
      input_tokens:
        estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt),
      total_tokens:
        estimateTextTokens(systemPrompt) + estimateTextTokens(userPrompt),
    };
    const reservation = await deps.quota.reserve({
      reservationId: `window:${windowId}:${stage}:${item.evidence_id}:${attempt_id}`,
      provider,
      model: window.model,
      operationType: "chat",
      scopeKey: `window:${windowId}:${stage}`,
      dimensions: reservedDimensions,
      processKind: "window",
      processId: windowId,
      workflowId,
    });

    try {
      if (!reservation.allowed) {
        throw new Error(
          `Quota reservation denied for ${stage}: ${reservation.reason ?? "quota_denied"}`,
        );
      }

      const result = await deps.runOpenAiChat({
        model: window.model,
        systemPrompt,
        userPrompt,
      });
      await convex.recordLlmAttemptFinish({
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
        model: window.model,
        operationType: "chat",
        scopeKey: `window:${windowId}:${stage}`,
        reserved: reservedDimensions,
        observed: buildObservedDimensions(result),
        status: "applied",
      });
      await convex.applyWindowStageResult({
        window_id: windowId,
        evidence_id: item.evidence_id,
        stage,
        attempt_id,
        output: result.assistant_output,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        total_tokens: result.total_tokens,
      });
      successCount += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (reservation.allowed) {
        await deps.quota.settle({
          reservationId: reservation.reservationId,
          provider,
          model: window.model,
          operationType: "chat",
          scopeKey: `window:${windowId}:${stage}`,
          reserved: reservedDimensions,
          observed: { requests: 1 },
          status: "failed",
        });
      }
      await convex.recordLlmAttemptFinish({
        attempt_id,
        status: "failed",
        error_message: message,
      });
      await convex.markWindowStageFailure({
        window_id: windowId,
        evidence_id: item.evidence_id,
        stage,
        attempt_id,
        error_message: message,
      });
      failureCount += 1;
    }
  }

  if (successCount === 0 && failureCount > 0) {
    const errorMessage = `All ${stage} attempts failed for window ${windowId}`;
    await convex.markWindowProcessError({
      window_id: windowId,
      stage,
      error_message: errorMessage,
    });
    return {
      processKind: "window",
      processId: windowId,
      stage,
      summary: `window_stage:${stage}:failed=${failureCount}`,
      haltProcess: true,
      terminalExecutionStatus: "failed",
      errorMessage,
    };
  }

  return {
    processKind: "window",
    processId: windowId,
    stage,
    summary: `window_stage:${stage}:success=${successCount}:failed=${failureCount}`,
  };
}

export async function runWindowStageActivity(
  windowId: string,
  stage: WindowStageKey,
): Promise<StageActivityResult<WindowStageKey>> {
  return runWindowStageActivityWithDeps(
    getDefaultWindowStageDependencies(),
    windowId,
    stage,
  );
}
