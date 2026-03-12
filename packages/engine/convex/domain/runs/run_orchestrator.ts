import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { type ModelType } from "../../platform/providers/provider_types";
import { BaseOrchestrator } from "../orchestrator/base";
import {
  buildScoreCriticVerdictSummary,
  buildRubricCriticPrompt,
  buildRubricGenPrompt,
  buildScoreCriticPrompt,
  buildScoreGenPrompt,
} from "./run_prompts";
import {
  normalizeExperimentConfig,
  resolveEvidenceStrategy,
  type ExperimentConfig,
} from "./run_strategies";
import { type RunStage } from "../../models/experiments";
import { getRunStageProgress } from "./run_progress";

type SampleDoc = Doc<"samples">;
type SampleScoreTargetDoc = Doc<"sample_score_targets">;
type SampleScoreTargetItemDoc = Doc<"sample_score_target_items">;
type SampleStage = Exclude<RunStage, "score_gen" | "score_critic">;

type RequestState = "pending" | "none" | "retryable" | "exhausted";
type RequestStateIndex = {
  stateByKey: Map<string, RequestState>;
};

const SCORE_STAGES: RunStage[] = ["score_gen", "score_critic"];
const STAGE_ORDER: RunStage[] = [
  "rubric_gen",
  "rubric_critic",
  "score_gen",
  "score_critic",
];

export type RunRequestTargetType = "sample" | "sample_score_target";

type ParsedRequestKey = {
  targetType: RunRequestTargetType;
  targetId: string;
  stage: RunStage;
};

type HydratedScoreTarget = {
  target: SampleScoreTargetDoc;
  sample: SampleDoc;
  items: Array<{
    item: SampleScoreTargetItemDoc;
    evidence: Doc<"evidences">;
  }>;
};

function renderBundledEvidence(
  items: Array<{ evidence: Doc<"evidences"> }>,
  config: ExperimentConfig,
) {
  const evidenceStrategy = resolveEvidenceStrategy(config);
  return {
    l0_raw_content: items.map(({ evidence }, index) => {
      return [
        `EVIDENCE ${index + 1}`,
        evidence.l0_raw_content,
      ].join("\n");
    }).join("\n\n"),
    l1_cleaned_content: items.map(({ evidence }, index) => {
      return [
        `EVIDENCE ${index + 1}`,
        evidence.l1_cleaned_content ?? evidence.l0_raw_content,
      ].join("\n");
    }).join("\n\n"),
    l2_neutralized_content: items.map(({ evidence }, index) => {
      return [
        `EVIDENCE ${index + 1}`,
        evidence.l2_neutralized_content ?? evidence.l1_cleaned_content ?? evidence.l0_raw_content,
      ].join("\n");
    }).join("\n\n"),
    l3_abstracted_content: items.map(({ evidence }, index) => {
      return [
        `EVIDENCE ${index + 1}`,
        evidence.l3_abstracted_content ?? evidence.l2_neutralized_content ?? evidence.l1_cleaned_content ?? evidence.l0_raw_content,
      ].join("\n");
    }).join("\n\n"),
    selected_content: items.map(({ evidence }, index) => {
      const selected = evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
      return [
        `EVIDENCE ${index + 1}`,
        selected,
      ].join("\n");
    }).join("\n\n"),
  };
}

export class RunOrchestrator extends BaseOrchestrator<Id<"runs">, RunStage> {
  constructor(ctx: MutationCtx) {
    super(ctx);
  }

  public async getStageProgress(
    runId: Id<"runs">,
    stage: RunStage,
  ): Promise<{ completed: number; failed: number; hasPending: boolean } | null> {
    const progress = await getRunStageProgress(this.ctx, runId, stage);
    if (!progress) return null;
    return {
      completed: progress.completed,
      failed: progress.failed,
      hasPending: progress.hasPending,
    };
  }

  public nextStageFor(stage: RunStage): RunStage | null {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx === -1) return null;
    return STAGE_ORDER[idx + 1] ?? null;
  }

  private classifyRequestState(index: RequestStateIndex, customKey: string): RequestState {
    return index.stateByKey.get(customKey) ?? "none";
  }

  private async buildRequestStateIndex(
    runId: Id<"runs">,
    customKeys: Set<string>,
    stage: RunStage,
  ): Promise<RequestStateIndex> {
    if (customKeys.size === 0) {
      return { stateByKey: new Map() };
    }

    const rows = await this.ctx.db
      .query("process_request_targets")
      .withIndex("by_process_stage", (q) =>
        q.eq("process_type", "run").eq("process_id", runId).eq("stage", stage),
      )
      .collect();

    const stateByKey = new Map<string, RequestState>();
    for (const row of rows) {
      if (!customKeys.has(row.custom_key)) continue;
      if (row.resolution === "pending") {
        stateByKey.set(row.custom_key, "pending");
      } else if (row.resolution === "exhausted") {
        stateByKey.set(row.custom_key, "exhausted");
      } else if (row.resolution === "retryable") {
        stateByKey.set(row.custom_key, "retryable");
      }
    }
    return { stateByKey };
  }

  protected async listPendingTargets(runId: Id<"runs">, stage: RunStage) {
    const run = await this.ctx.db.get(runId);
    if (!run) throw new Error("Run not found");
    const rawExperiment = await this.ctx.db.get(run.experiment_id);
    if (!rawExperiment) throw new Error("Experiment not found");
    const config = normalizeExperimentConfig(rawExperiment);

    if (!SCORE_STAGES.includes(stage)) {
      return this.listPendingSampleTargets(runId, stage as SampleStage, config);
    }

    const scoreTargets = await this.listScoreTargetsForRun(runId);
    return this.listPendingSampleScoreTargets(scoreTargets, stage, config, runId);
  }

  protected async getModelForStage(
    runId: Id<"runs">,
    stage: RunStage,
  ): Promise<ModelType> {
    const run = await this.ctx.db.get(runId);
    if (!run) throw new Error("Run not found");
    const experiment = await this.ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    if (stage === "rubric_gen" || stage === "rubric_critic") {
      return experiment.rubric_config.model;
    }
    return experiment.scoring_config.model;
  }

  protected buildPrompts(stage: RunStage, input: string) {
    switch (stage) {
      case "rubric_gen": {
        const payload = JSON.parse(input) as {
          concept: string;
          scale_size: number;
        };
        const prompts = buildRubricGenPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "rubric_critic": {
        const payload = JSON.parse(input) as {
          concept: string;
          rubric: { stages: Array<{ label: string; criteria: string[] }> };
        };
        const prompts = buildRubricCriticPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "score_gen": {
        const payload = JSON.parse(input) as Parameters<typeof buildScoreGenPrompt>[0];
        const prompts = buildScoreGenPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "score_critic": {
        const payload = JSON.parse(input) as Parameters<typeof buildScoreCriticPrompt>[0];
        const prompts = buildScoreCriticPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      default:
        throw new Error(`Unsupported run stage: ${stage}`);
    }
  }

  public makeRequestKey(targetId: string, stage: RunStage): string {
    const prefix = SCORE_STAGES.includes(stage) ? "sample_score_target" : "sample";
    return this.makeRequestKeyForTarget(prefix, targetId, stage);
  }

  public parseRequestKey(key: string): ParsedRequestKey {
    const [targetType, targetId, stage] = key.split(":");
    if (targetType !== "sample" && targetType !== "sample_score_target") {
      throw new Error(`Unexpected target type in key: ${key}`);
    }
    if (!STAGE_ORDER.includes(stage as RunStage)) {
      throw new Error(`Unexpected stage in key: ${key}`);
    }
    return {
      targetType,
      targetId,
      stage: stage as RunStage,
    };
  }

  public makeProcessKey(processId: Id<"runs">, stage: RunStage): string {
    return `run:${processId}:${stage}`;
  }

  public parseProcessKey(key: string): { processId: Id<"runs">; stage: RunStage } {
    const [processType, processId, stage] = key.split(":");
    if (processType !== "run") {
      throw new Error(`Unexpected process type in key: ${key}`);
    }
    return { processId: processId as Id<"runs">, stage: stage as RunStage };
  }

  private getSampleOutputId(sample: SampleDoc, stage: SampleStage) {
    return stage === "rubric_gen" ? sample.rubric_id : sample.rubric_critic_id;
  }

  private isSampleStageBlocked(sample: SampleDoc, stage: SampleStage) {
    return stage === "rubric_gen" ? false : sample.rubric_id == null;
  }

  private isScoreTargetStageBlocked(
    target: SampleScoreTargetDoc,
    sample: SampleDoc,
    stage: RunStage,
  ) {
    if (stage === "score_gen") {
      return sample.rubric_id == null;
    }
    return sample.rubric_id == null || target.score_id == null;
  }

  private async listPendingSampleTargets(
    runId: Id<"runs">,
    stage: SampleStage,
    config: ExperimentConfig,
  ) {
    const pending: Array<{ targetId: string; input: string }> = [];
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    const candidateKeys = new Set<string>();
    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;
      candidateKeys.add(this.makeRequestKeyForTarget("sample", sample._id, stage));
    }
    const requestStateIndex = await this.buildRequestStateIndex(runId, candidateKeys, stage);

    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;

      const customKey = this.makeRequestKeyForTarget("sample", sample._id, stage);
      const state = this.classifyRequestState(requestStateIndex, customKey);
      if (state === "pending" || state === "exhausted") continue;

      const payload = await this.buildRubricPayload(stage, sample, config);
      if (!payload) continue;
      pending.push({ targetId: sample._id, input: JSON.stringify(payload) });
    }

    return pending;
  }

  private async listPendingSampleScoreTargets(
    scoreTargets: SampleScoreTargetDoc[],
    stage: RunStage,
    config: ExperimentConfig,
    runId: Id<"runs">,
  ) {
    const pending: Array<{ targetId: string; input: string }> = [];
    const sampleById = await this.mapSamplesByRun(runId);
    const hydratedTargets = await this.hydrateScoreTargets(scoreTargets);
    const candidateKeys = new Set<string>();
    const runnableTargets: HydratedScoreTarget[] = [];

    for (const hydrated of hydratedTargets) {
      const outputId = stage === "score_gen" ? hydrated.target.score_id : hydrated.target.score_critic_id;
      if (outputId) continue;
      if (this.isScoreTargetStageBlocked(hydrated.target, hydrated.sample, stage)) continue;
      if (!sampleById.get(String(hydrated.sample._id))) continue;
      runnableTargets.push(hydrated);
      candidateKeys.add(this.makeRequestKey(hydrated.target._id, stage));
    }

    const requestStateIndex = await this.buildRequestStateIndex(runId, candidateKeys, stage);
    const rubricBySampleId = await this.mapRubricsBySampleId(runnableTargets);
    const scoreByTargetId =
      stage === "score_critic" ? await this.mapScoresByTargetId(runnableTargets) : new Map();

    for (const hydrated of runnableTargets) {
      const customKey = this.makeRequestKey(hydrated.target._id, stage);
      const state = this.classifyRequestState(requestStateIndex, customKey);
      if (state === "pending" || state === "exhausted") continue;

      const payload = this.buildScorePayloadForTarget(
        stage,
        hydrated,
        config,
        rubricBySampleId.get(String(hydrated.sample._id)),
        scoreByTargetId.get(String(hydrated.target._id)),
      );
      if (!payload) continue;

      pending.push({
        targetId: hydrated.target._id,
        input: JSON.stringify(payload),
      });
    }

    return pending;
  }

  private async buildRubricPayload(stage: RunStage, sample: SampleDoc, config: ExperimentConfig) {
    if (stage === "rubric_gen") {
      return {
        concept: config.rubric_config.concept,
        scale_size: config.rubric_config.scale_size,
      };
    }

    if (stage === "rubric_critic") {
      if (!sample.rubric_id) return null;
      const rubric = await this.ctx.db.get(sample.rubric_id);
      if (!rubric) return null;
      return {
        concept: rubric.concept,
        rubric: {
          stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        },
      };
    }
    return null;
  }

  private buildScorePayloadForTarget(
    stage: RunStage,
    hydrated: HydratedScoreTarget,
    config: ExperimentConfig,
    rubric: Doc<"rubrics"> | null | undefined,
    score: Doc<"scores"> | null | undefined,
  ) {
    if (!rubric || !hydrated.sample.rubric_id || hydrated.items.length === 0) return null;

    const renderedEvidence = renderBundledEvidence(hydrated.items, config);

    if (stage === "score_gen") {
      return {
        config,
        evidence: {
          l0_raw_content: renderedEvidence.l0_raw_content,
          l1_cleaned_content: renderedEvidence.l1_cleaned_content,
          l2_neutralized_content: renderedEvidence.l2_neutralized_content,
          l3_abstracted_content: renderedEvidence.l3_abstracted_content,
        },
        rubric: {
          stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        },
        sample: {
          label_mapping: rubric.label_mapping,
          display_seed: hydrated.sample.seed,
        },
      };
    }

    if (!score) return null;
    return {
      evidence: renderedEvidence.selected_content,
      rubric: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
      verdict: buildScoreCriticVerdictSummary({
        decoded_scores: score.decoded_scores,
        rubric_stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        method: config.scoring_config.method,
        justification: score.justification,
      }),
      grouping_mode: config.scoring_config.evidence_grouping.mode,
    };
  }

  private async hydrateScoreTargets(targets: SampleScoreTargetDoc[]): Promise<HydratedScoreTarget[]> {
    const sampleIds = new Set(targets.map((target) => String(target.sample_id)));
    const scoreTargetIds = targets.map((target) => target._id);

    const samples = await Promise.all(
      Array.from(sampleIds).map((sampleId) => this.ctx.db.get(sampleId as Id<"samples">)),
    );
    const sampleById = new Map(
      samples.filter((sample): sample is SampleDoc => sample != null)
        .map((sample) => [String(sample._id), sample]),
    );

    const itemRows = (
      await Promise.all(
        scoreTargetIds.map((scoreTargetId) =>
          this.ctx.db
            .query("sample_score_target_items")
            .withIndex("by_score_target", (q) => q.eq("score_target_id", scoreTargetId))
            .collect(),
        ),
      )
    ).flat();

    const evidenceIds = new Set(itemRows.map((item) => String(item.evidence_id)));
    const evidences = await Promise.all(
      Array.from(evidenceIds).map((evidenceId) => this.ctx.db.get(evidenceId as Id<"evidences">)),
    );
    const evidenceById = new Map(
      evidences.filter((evidence): evidence is Doc<"evidences"> => evidence != null)
        .map((evidence) => [String(evidence._id), evidence]),
    );

    const itemsByTargetId = new Map<string, Array<{ item: SampleScoreTargetItemDoc; evidence: Doc<"evidences"> }>>();
    for (const item of itemRows) {
      const evidence = evidenceById.get(String(item.evidence_id));
      if (!evidence) continue;
      const current = itemsByTargetId.get(String(item.score_target_id)) ?? [];
      current.push({ item, evidence });
      itemsByTargetId.set(String(item.score_target_id), current);
    }

    return targets.flatMap((target) => {
      const sample = sampleById.get(String(target.sample_id));
      if (!sample) return [];
      const items = (itemsByTargetId.get(String(target._id)) ?? [])
        .slice()
        .sort((left, right) => left.item.position - right.item.position);
      return [{ target, sample, items }];
    });
  }

  private async mapRubricsBySampleId(
    targets: HydratedScoreTarget[],
  ): Promise<Map<string, Doc<"rubrics"> | null>> {
    const rubricIds = new Set<string>();
    for (const { sample } of targets) {
      if (sample.rubric_id) rubricIds.add(String(sample.rubric_id));
    }

    const rubricById = new Map<string, Doc<"rubrics"> | null>();
    for (const rubricId of rubricIds) {
      const rubric = await this.ctx.db.get(rubricId as Id<"rubrics">);
      rubricById.set(rubricId, rubric ?? null);
    }

    const rubricBySampleId = new Map<string, Doc<"rubrics"> | null>();
    for (const { sample } of targets) {
      rubricBySampleId.set(
        String(sample._id),
        sample.rubric_id ? (rubricById.get(String(sample.rubric_id)) ?? null) : null,
      );
    }
    return rubricBySampleId;
  }

  private async mapScoresByTargetId(
    targets: HydratedScoreTarget[],
  ): Promise<Map<string, Doc<"scores"> | null>> {
    const scoreIds = new Set<string>();
    for (const { target } of targets) {
      if (target.score_id) scoreIds.add(String(target.score_id));
    }

    const scoreById = new Map<string, Doc<"scores"> | null>();
    for (const scoreId of scoreIds) {
      const score = await this.ctx.db.get(scoreId as Id<"scores">);
      scoreById.set(scoreId, score ?? null);
    }

    const scoreByTargetId = new Map<string, Doc<"scores"> | null>();
    for (const { target } of targets) {
      scoreByTargetId.set(
        String(target._id),
        target.score_id ? (scoreById.get(String(target.score_id)) ?? null) : null,
      );
    }
    return scoreByTargetId;
  }

  private async listScoreTargetsForRun(runId: Id<"runs">) {
    return this.ctx.db
      .query("sample_score_targets")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();
  }

  private async mapSamplesByRun(runId: Id<"runs">) {
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();
    return new Map(samples.map((sample) => [String(sample._id), sample]));
  }

  private makeRequestKeyForTarget(
    targetType: RunRequestTargetType,
    targetId: string,
    stage: RunStage,
  ) {
    return `${targetType}:${targetId}:${stage}`;
  }
}
