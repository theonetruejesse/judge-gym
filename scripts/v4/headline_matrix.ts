export const HEADLINE_PROVIDERS = [
  "gpt-4.1",
  "gpt-5.2",
  "claude-sonnet-4",
  "qwen-current-text-flagship",
] as const;

export type HeadlineProvider = (typeof HEADLINE_PROVIDERS)[number];
export type HeadlineCohort = "baseline" | "abstention" | "gilardi_l2" | "full";

const MODEL_TAG_SUFFIX: Record<HeadlineProvider, string> = {
  "gpt-4.1": "gpt41",
  "gpt-5.2": "gpt52",
  "claude-sonnet-4": "claude_sonnet4",
  "qwen-current-text-flagship": "qwen",
};

export function modelTagSuffix(model: HeadlineProvider) {
  return MODEL_TAG_SUFFIX[model];
}

export function gilardiExperimentTag(args: {
  condition: "baseline" | "abstention_on" | "view_l2_neutralized";
  model: HeadlineProvider;
}) {
  return `gilardi_relevance_v1_${args.condition}_${modelTagSuffix(args.model)}`;
}

export function zhengExperimentTag(args: {
  condition: "baseline" | "abstention_on";
  model: HeadlineProvider;
}) {
  return `zheng_mt_bench_pair_v2_v1_${args.condition}_${modelTagSuffix(args.model)}`;
}

export function resolveCohortExperimentTags(cohort: HeadlineCohort) {
  const baseline = [
    ...HEADLINE_PROVIDERS.map((model) =>
      gilardiExperimentTag({ condition: "baseline", model })),
    ...HEADLINE_PROVIDERS.map((model) =>
      zhengExperimentTag({ condition: "baseline", model })),
  ];
  const abstention = [
    ...HEADLINE_PROVIDERS.map((model) =>
      gilardiExperimentTag({ condition: "abstention_on", model })),
    ...HEADLINE_PROVIDERS.map((model) =>
      zhengExperimentTag({ condition: "abstention_on", model })),
  ];
  const gilardiL2 = HEADLINE_PROVIDERS.map((model) =>
    gilardiExperimentTag({ condition: "view_l2_neutralized", model }));

  switch (cohort) {
    case "baseline":
      return baseline;
    case "abstention":
      return abstention;
    case "gilardi_l2":
      return gilardiL2;
    case "full":
      return [...baseline, ...abstention, ...gilardiL2];
  }
}
