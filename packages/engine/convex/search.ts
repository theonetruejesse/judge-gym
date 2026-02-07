"use node";

import Firecrawl from "@mendable/firecrawl-js";
import { env } from "./env";
import { zInternalAction } from "./utils";
import z from "zod";

const firecrawl = new Firecrawl({ apiKey: env.FIRECRAWL_API_KEY });

// --- Search news via Firecrawl ---

export const searchNews = zInternalAction({
  args: z.object({
    concept: z.string(),
    country: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    limit: z.number(),
  }),
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
        rawContent: n.markdown as string,
      }));
  },
});

// --- Internals ---

interface SearchOptions {
  concept: string;
  country: string;
  limit: number;
  startDate: string;
  endDate: string;
}

async function searchHeadlines(options: SearchOptions) {
  const { concept, country, startDate, endDate, limit } = options;

  const response = await firecrawl.search(`${concept} ${country} news`, {
    limit,
    sources: ["news"],
    location: country,
    tbs: `cdr:1,cd_min:${toSearchDate(startDate)},cd_max:${toSearchDate(endDate)}`,
    scrapeOptions: {
      formats: ["markdown"],
    },
  });

  if (!response || !response.news) throw new Error("Firecrawl search failed");

  return response.news;
}

/** Convert ISO date (2026-01-01) → Firecrawl tbs format (01/01/2026). */
function toSearchDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}
