"use node";

import Firecrawl from "@mendable/firecrawl-js";
import z from "zod";
import { zInternalAction } from "../../platform/utils";
import { getEnv } from "../../env";

export const searchNews = zInternalAction({
  args: z.object({
    concept: z.string(), // todo, change this into a true query instead
    country: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    limit: z.number(),
  }),
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
  concept: string;
  country: string;
  limit: number;
  start_date: string;
  end_date: string;
}

async function searchHeadlines(options: SearchOptions) {
  const { concept, country, start_date, end_date, limit } = options;
  const apiKey = getEnv("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY is not set");

  const firecrawl = new Firecrawl({ apiKey });
  const response = await firecrawl.search(`${concept} ${country} news`, {
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
