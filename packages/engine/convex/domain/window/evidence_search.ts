"use node";

import Firecrawl from "@mendable/firecrawl-js";
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

export const searchNews = zInternalAction({
    args: SearchArgsSchema,
    returns: z.array(
        z.object({
            title: z.string(),
            url: z.string(),
            raw_content: z.string(),
        }),
    ),
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
    const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
    const response = await firecrawl.search(`${query} ${country} news articles`, {
        limit,
        sources: ["news"],
        location: country,
        tbs: `cdr:1,cd_min:${toSearchDate(start_date)},cd_max:${toSearchDate(end_date)}`,
        scrapeOptions: {
            formats: ["markdown"],
        },
    });

    if (!response || !response.news) throw new Error("Firecrawl search failed");

    return response.news;
}

/** Convert ISO date (2026-01-01) -> Firecrawl tbs format (01/01/2026). */
function toSearchDate(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${month}/${day}/${year}`;
}
