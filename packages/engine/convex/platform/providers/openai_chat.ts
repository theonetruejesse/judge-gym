import { getProviderModel, type ModelType } from "./provider_types";

type ChatInput = {
  model: ModelType;
  system_prompt?: string;
  user_prompt: string;
  max_tokens?: number;
};

type ChatOutput = {
  assistant_output: string;
  input_tokens?: number;
  output_tokens?: number;
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

async function fetchJson(url: string, init: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

export async function openAiChat(input: ChatInput): Promise<ChatOutput> {
  const apiKey = requireKey();
  const messages = [] as Array<{ role: string; content: string }>;
  if (input.system_prompt) {
    messages.push({ role: "system", content: input.system_prompt });
  }
  messages.push({ role: "user", content: input.user_prompt });

  const body: Record<string, unknown> = {
    model: getProviderModel(input.model),
    messages,
  };
  if (input.max_tokens !== undefined) body.max_tokens = input.max_tokens;

  const result = await fetchJson(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const choice = result.choices?.[0]?.message;
  const output = choice?.content ?? "";
  return {
    assistant_output: output,
    input_tokens: result.usage?.prompt_tokens,
    output_tokens: result.usage?.completion_tokens,
  };
}
