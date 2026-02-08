import z from "zod";
import { zid } from "convex-helpers/server/zod4";
import { zInternalAction } from "../../utils";
import { internal } from "../../_generated/api";
import {
  EvidenceCleaner,
  Neutralizer,
  StructuralAbstractor,
} from "./evidence_agent";

const DEFAULT_CONCURRENCY = 10;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 500;

/**
 * Process a list of items in parallel using a bounded number of concurrent workers.
 *
 * @param items - The array of items to process.
 * @param limit - Maximum number of concurrent workers; treated as at least 1 and at most the number of items.
 * @param worker - Async handler invoked for each item.
 * @returns Void when all items have been processed.
 */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const concurrency = Math.max(1, Math.min(limit, items.length));
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      await worker(items[current]);
    }
  });
  await Promise.all(workers);
}

/**
 * Retry an asynchronous function on failure using exponential backoff with jitter.
 *
 * @param fn - The async function to invoke
 * @param retries - Maximum number of retry attempts after the initial try (total attempts = `retries + 1`)
 * @param baseDelayMs - Base delay in milliseconds used to compute exponential backoff; a random jitter up to `baseDelayMs` is added to each delay
 * @returns The resolved value from `fn` if a call succeeds
 * @throws The last error thrown by `fn` if all attempts (initial + retries) fail
 */
async function withRetries<T>(
  fn: () => Promise<T>,
  {
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BACKOFF_MS,
  }: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries) throw err;
      const jitter = Math.floor(Math.random() * baseDelayMs);
      const delay = baseDelayMs * 2 ** attempt + jitter;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt += 1;
    }
  }
}

/**
 * Format an error-like value into a readable string.
 *
 * @param err - The value to format (an Error or any other value)
 * @returns The error's `message` if `err` is an `Error`, otherwise `String(err)`
 */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// --- Clean evidence (strip boilerplate) ---
export const cleanBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidences")) }),
  handler: async (ctx, { evidenceIds }) => {
    const cleaner = new EvidenceCleaner();
    const failures: { evidenceId: string; error: string }[] = [];

    await runWithConcurrency(evidenceIds, DEFAULT_CONCURRENCY, async (evidenceId) => {
      try {
        await withRetries(async () => {
          const evidence = await ctx.runQuery(internal.repo.getEvidence, {
            evidenceId,
          });
          const cleaned = await cleaner.clean(ctx, evidence.rawContent);
          await ctx.runMutation(internal.repo.patchEvidence, {
            evidenceId,
            cleanedContent: cleaned,
          });
        });
      } catch (err) {
        failures.push({ evidenceId: evidenceId.toString(), error: formatError(err) });
      }
    });

    if (failures.length > 0) {
      throw new Error(
        `Failed to clean ${failures.length}/${evidenceIds.length} evidence items. ` +
        `First error: ${failures[0].error}`,
      );
    }
  },
});

// --- Neutralize evidence (tone removal) ---
export const neutralizeBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidences")) }),
  handler: async (ctx, { evidenceIds }) => {
    const neutralizer = new Neutralizer();
    const failures: { evidenceId: string; error: string }[] = [];

    await runWithConcurrency(evidenceIds, DEFAULT_CONCURRENCY, async (evidenceId) => {
      try {
        await withRetries(async () => {
          const evidence = await ctx.runQuery(internal.repo.getEvidence, {
            evidenceId,
          });
          const input = evidence.cleanedContent ?? evidence.rawContent;
          const neutralized = await neutralizer.neutralize(ctx, input);
          await ctx.runMutation(internal.repo.patchEvidence, {
            evidenceId,
            neutralizedContent: neutralized,
          });
        });
      } catch (err) {
        failures.push({ evidenceId: evidenceId.toString(), error: formatError(err) });
      }
    });

    if (failures.length > 0) {
      throw new Error(
        `Failed to neutralize ${failures.length}/${evidenceIds.length} evidence items. ` +
        `First error: ${failures[0].error}`,
      );
    }
  },
});

// --- Structural abstraction (entity anonymization) ---
export const abstractBatch = zInternalAction({
  args: z.object({ evidenceIds: z.array(zid("evidences")) }),
  handler: async (ctx, { evidenceIds }) => {
    const abstractor = new StructuralAbstractor();
    const failures: { evidenceId: string; error: string }[] = [];

    await runWithConcurrency(evidenceIds, DEFAULT_CONCURRENCY, async (evidenceId) => {
      try {
        await withRetries(async () => {
          const evidence = await ctx.runQuery(internal.repo.getEvidence, {
            evidenceId,
          });
          const input =
            evidence.neutralizedContent ??
            evidence.cleanedContent ??
            evidence.rawContent;
          const abstracted = await abstractor.abstract(ctx, input);
          await ctx.runMutation(internal.repo.patchEvidence, {
            evidenceId,
            abstractedContent: abstracted,
          });
        });
      } catch (err) {
        failures.push({ evidenceId: evidenceId.toString(), error: formatError(err) });
      }
    });

    if (failures.length > 0) {
      throw new Error(
        `Failed to abstract ${failures.length}/${evidenceIds.length} evidence items. ` +
        `First error: ${failures[0].error}`,
      );
    }
  },
});

// --- Load pre-curated benchmark evidence ---
export const loadBenchmarkEvidence = zInternalAction({
  args: z.object({ windowId: zid("windows") }),
  handler: async (ctx, { windowId }): Promise<number> => {
    const window = await ctx.runQuery(internal.repo.getWindow, { windowId });
    const concept = window.concept;
    // Load from Convex file storage — dataset uploaded during setup
    // Implementation depends on how benchmark data is stored
    // Returns count of evidence items loaded
    throw new Error("TODO: implement benchmark evidence loading");
  },
});