"use node";

import Firecrawl from "@mendable/firecrawl-js";
import { DEFAULT_ENGINE_SETTINGS } from "@judge-gym/engine-settings";
import z from "zod";
import { zInternalAction } from "../../utils/custom_fns";
import { WindowsTableSchema } from "../../models/window";

const SearchArgsSchema = WindowsTableSchema.pick({
    query: true,
    country: true,
    start_date: true,
    end_date: true,
}).extend({
    limit: z.number(),
});

const SearchResultSchema = z.object({
    title: z.string(),
    url: z.string(),
    raw_content: z.string(),
});

const FIRECRAWL_SETTINGS = DEFAULT_ENGINE_SETTINGS.window.firecrawl;

export type SearchNewsResults = Array<z.infer<typeof SearchResultSchema>>;

export const searchNews = zInternalAction({
    args: SearchArgsSchema,
    returns: z.array(SearchResultSchema),
    handler: async (_ctx, args) => {
        const news = await searchHeadlines(args);
        return news
            .filter(
                (n: any) =>
                    typeof n.markdown === "string" &&
                    n.markdown.trim().length > 0 &&
                    typeof n.title === "string" &&
                    n.title.trim().length > 0 &&
                    typeof n.url === "string" &&
                    n.url.trim().length > 0,
            )
            .map((n: any) => ({
                title: n.title as string,
                url: n.url as string,
                raw_content: n.markdown as string,
            }));
    },
});

interface SearchOptions {
    query: string;
    country: string;
    limit: number;
    start_date: string;
    end_date: string;
}

async function searchHeadlines(options: SearchOptions) {
    const { query, country, start_date, end_date, limit } = options;
    const firecrawl = new Firecrawl({
        apiKey: process.env.FIRECRAWL_API_KEY,
        timeoutMs: FIRECRAWL_SETTINGS.requestTimeoutMs,
        maxRetries: FIRECRAWL_SETTINGS.clientMaxRetries,
    });
    const response = await withTimeout(
        firecrawl.search(buildSearchQuery(query, country), {
            limit,
            sources: FIRECRAWL_SETTINGS.sources,
            location: country,
            tbs: `cdr:1,cd_min:${toSearchDate(start_date)},cd_max:${toSearchDate(end_date)}`,
            timeout: FIRECRAWL_SETTINGS.searchTimeoutMs,
            scrapeOptions: {
                formats: ["markdown"],
            },
        }),
        FIRECRAWL_SETTINGS.searchTimeoutMs,
        `Firecrawl search timed out after ${FIRECRAWL_SETTINGS.searchTimeoutMs}ms`,
    );

    if (!response || !response.news) {
        throw new Error("Firecrawl search failed");
    }

    return response.news;
}

/** Convert ISO date (2026-01-01) -> Firecrawl tbs format (01/01/2026). */
function toSearchDate(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
}

function buildSearchQuery(query: string, country: string): string {
    const parts = [
        query,
        FIRECRAWL_SETTINGS.includeCountryInQuery ? country : null,
        FIRECRAWL_SETTINGS.querySuffix,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));
    return parts.join(" ");
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
            }),
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}
