import { getModelConfig } from "../window/model_registry";
import { parseAssistantOutput, type ChatResult } from "./openai";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";

function requireOpenRouterKey() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  return key;
}

async function openRouterRequest(
  path: string,
  init: RequestInit,
  timeoutMs?: number,
) {
  const timeoutSignal =
    typeof timeoutMs === "number" && timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : undefined;
  const signal =
    init.signal && timeoutSignal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : (init.signal ?? timeoutSignal);
  return fetch(`${OPENROUTER_API_BASE}${path}`, {
    ...init,
    signal,
    headers: {
      Authorization: `Bearer ${requireOpenRouterKey()}`,
      ...(init.headers ?? {}),
    },
  });
}

export async function runOpenRouterChat(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
}): Promise<ChatResult> {
  const { providerModel } = getModelConfig(args.model);
  const response = await openRouterRequest("/chat/completions", {
    method: "POST",
    headers: {
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
  }, args.timeoutMs);

  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter API error ${response.status}: ${bodyText}`);
  }
  const body = bodyText ? JSON.parse(bodyText) : {};

  return {
    assistant_output: parseAssistantOutput(body.choices?.[0]?.message?.content),
    input_tokens: body.usage?.prompt_tokens ?? null,
    output_tokens: body.usage?.completion_tokens ?? null,
    total_tokens: body.usage?.total_tokens ?? null,
  };
}
