export const NEUTRALIZE_INSTRUCTIONS = `
You are a clinical editor. Your job is to strip all stylistic and
rhetorical content from news articles, producing only factual summaries.
`;

export const neutralizePrompt = (rawContent: string) => `
Rewrite the following article as a 200-word clinical summary.

RULES:
- Preserve only factual claims, statistics, and named sources.
- Remove all emotional language, rhetorical questions, and editorializing.
- Remove all adjectives that convey judgment (e.g., "alarming", "unprecedented").
- Use passive voice where possible to reduce authorial presence.
- Do not add any information not present in the original.
- If the article is too short for 200 words, summarize in fewer words.

ARTICLE:
${rawContent}

Start your response with "Article Summary:".
`;
