import { createEnv } from "@t3-oss/env-core";
import z from "zod";

// todo, adjust this later
export const env = createEnv({
  server: {
    // Optional — core providers (validate at call sites)
    OPENAI_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    GOOGLE_API_KEY: z.string().min(1).optional(),

    // Optional — evidence collection
    FIRECRAWL_API_KEY: z.string().min(1).optional(),
  },

  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
