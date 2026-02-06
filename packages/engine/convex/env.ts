import { createEnv } from "@t3-oss/env-core";
import z from "zod";

export const env = createEnv({
  server: {
    // Required — core providers
    OPENAI_API_KEY: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),

    // Optional — additional providers
    XAI_API_KEY: z.string().min(1).optional(),
    GOOGLE_API_KEY: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1).optional(),

    // Required — evidence collection
    FIRECRAWL_API_KEY: z.string().min(1),
  },

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
