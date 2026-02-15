export const EVIDENCE_CLEANING_INSTRUCTIONS = `
You are cleaning scraped news article markdown. The input often contains
navigation menus, footer links, social/share widgets, repeated sections,
image-only lines, and unrelated page chrome.

GOAL:
Return a cleaned markdown body that preserves the article's core content,
headings, and key quotes while removing boilerplate.

RULES:
- Remove navigation menus, sidebars, footers, and unrelated link lists.
- Remove repeated "You may like" / "More from" / "Follow us" sections.
- Remove image-only lines (e.g. ![](url)) unless the caption is essential.
- Keep the main headline and article body paragraphs.
- Preserve inline emphasis and list structure when it is part of the article.
- Output must be concise but faithful; do not summarize or paraphrase.

Return ONLY the cleaned markdown body. Do not return JSON or any wrapper.
`;
export const cleanPrompt = (rawContent: string) => `
Clean the following scraped article markdown:

ARTICLE:
${rawContent}
`;


export const NEUTRALIZE_INSTRUCTIONS = `
You are a clinical editor. Your job is to strip all stylistic and
rhetorical content from news articles, producing only factual summaries.
`;
export const neutralizePrompt = (rawContent: string) => `
Rewrite the following article as a clinical summary.

RULES:
- Preserve only factual claims, statistics, and named sources.
- Remove all emotional language, rhetorical questions, and editorializing.
- Remove all adjectives that convey judgment (e.g., "alarming", "unprecedented").
- Use passive voice where possible to reduce authorial presence.
- Do not add any information not present in the original.
- Keep as much of the original content as possible.

ARTICLE:
${rawContent}

Start your response with "Neutralized Summary:".
`;


export const STRUCTURAL_ABSTRACTION_INSTRUCTIONS = `
You are a structural abstractor. Your job is to remove specific names,
places, organizations, and unique identifiers while preserving the type
and role of each entity and the factual relationships.
`;
export const abstractPrompt = (neutralizedContent: string) => `
Rewrite the following text to anonymize specific entities and locations.

RULES:
- Replace person names with role-based descriptors (e.g., "head of state",
  "opposition leader", "finance minister") when inferable.
- Replace countries/cities with generic types (e.g., "a modern federal republic",
  "a neighboring ally", "a regional capital").
- Replace organizations with their type (e.g., "a regional defense alliance",
  "an international aid agency") when inferable.
- Preserve the relationships, sequence of events, and policy actions.
- Do not add or remove facts; do not summarize or paraphrase.

TEXT:
${neutralizedContent}

Start your response with "Abstracted Summary:".
`;
