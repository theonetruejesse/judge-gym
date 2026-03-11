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
  type ExperimentConfig,
  resolveEvidenceStrategy,
} from "./run_strategies";
import { type RunStage } from "../../models/experiments";
import { ENGINE_SETTINGS } from "../../settings";
import { getRunStageProgress } from "./run_progress";

type SampleDoc = Doc<"samples">;
type SampleEvidenceScoreDoc = Doc<"sample_evidence_scores">;
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

export type RunRequestTargetType = "sample" | "sample_evidence";

type ParsedRequestKey = {
  targetType: RunRequestTargetType;
  targetId: string;
  stage: RunStage;
};

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
      return {
        stateByKey: new Map(),
      };
    }

    const rows = await this.ctx.db
      .query("process_request_targets")
      .withIndex("by_process_stage", (q) =>
        q
          .eq("process_type", "run")
          .eq("process_id", runId)
          .eq("stage", stage),
      )
      .collect();

    const stateByKey = new Map<string, RequestState>();

    for (const row of rows) {
      if (!customKeys.has(row.custom_key)) continue;
      if (row.resolution === "pending") {
        stateByKey.set(row.custom_key, "pending");
        continue;
      }
      if (row.resolution === "exhausted") {
        stateByKey.set(row.custom_key, "exhausted");
        continue;
      }
      if (row.resolution === "retryable") {
        stateByKey.set(row.custom_key, "retryable");
      }
    }

    return { stateByKey };
  }

  protected async listPendingTargets(runId: Id<"runs">, stage: RunStage) {
    const run = await this.ctx.db.get(runId);
    if (!run) throw new Error("Run not found");
    const experiment = await this.ctx.db.get(run.experiment_id);
    if (!experiment) throw new Error("Experiment not found");

    const config: ExperimentConfig = {
      rubric_config: {
        scale_size: experiment.rubric_config.scale_size,
        concept: experiment.rubric_config.concept,
      },
      scoring_config: {
        method: experiment.scoring_config.method,
        abstain_enabled: experiment.scoring_config.abstain_enabled,
        evidence_view: experiment.scoring_config.evidence_view,
        randomizations: experiment.scoring_config.randomizations,
      },
    };

    if (!SCORE_STAGES.includes(stage)) {
      return this.listPendingSampleTargets(runId, stage as SampleStage, config);
    }

    const scoreUnits = await this.listScoreUnitsForRun(runId);
    return this.listPendingSampleEvidenceTargets(scoreUnits, stage, config, runId);
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
        const prompts = buildRubricGenPrompt({
          concept: payload.concept,
          scale_size: payload.scale_size,
        });
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "rubric_critic": {
        const payload = JSON.parse(input) as {
          concept: string;
          rubric: { stages: Array<{ label: string; criteria: string[] }> };
        };
        const prompts = buildRubricCriticPrompt({
          concept: payload.concept,
          rubric: payload.rubric,
        });
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "score_gen": {
        const payload = JSON.parse(input) as Parameters<typeof buildScoreGenPrompt>[0];
        const prompts = buildScoreGenPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      case "score_critic": {
        const payload = JSON.parse(input) as {
          evidence: string;
          rubric: Array<{ label: string; criteria: string[] }>;
          verdict: ReturnType<typeof buildScoreCriticVerdictSummary>;
        };
        const prompts = buildScoreCriticPrompt(payload);
        return { system: prompts.system_prompt, user: prompts.user_prompt };
      }
      default:
        throw new Error(`Unsupported run stage: ${stage}`);
    }
  }

  public makeRequestKey(targetId: string, stage: RunStage): string {
    const prefix = SCORE_STAGES.includes(stage) ? "sample_evidence" : "sample";
    return this.makeRequestKeyForTarget(prefix, targetId, stage);
  }

  public parseRequestKey(key: string): ParsedRequestKey {
    const [targetType, targetId, stage] = key.split(":");
    if (targetType !== "sample" && targetType !== "sample_evidence") {
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

  private async getSampleStageProgress(
    runId: Id<"runs">,
    stage: SampleStage,
  ): Promise<{ completed: number; failed: number; hasPending: boolean } | null> {
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    if (samples.length === 0) return null;

    let completed = 0;
    let failed = 0;
    let hasPending = false;

    const candidateKeys = new Set<string>();
    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;
      candidateKeys.add(this.makeRequestKeyForTarget("sample", sample._id, stage));
    }
    const requestStateIndex = await this.buildRequestStateIndex(
      runId,
      candidateKeys,
      stage,
    );

    for (const sample of samples) {
      const outputId = this.getSampleOutputId(sample, stage);
      if (outputId) {
        completed += 1;
        continue;
      }

      if (this.isSampleStageBlocked(sample, stage)) {
        failed += 1;
        continue;
      }

      const customKey = this.makeRequestKeyForTarget("sample", sample._id, stage);
      const state = this.classifyRequestState(requestStateIndex, customKey);

      if (state === "pending" || state === "none" || state === "retryable") {
        hasPending = true;
        continue;
      }

      failed += 1;
    }

    return { completed, failed, hasPending };
  }

  private getSampleOutputId(
    sample: SampleDoc,
    stage: SampleStage,
  ) {
    if (stage === "rubric_gen") return sample.rubric_id;
    return sample.rubric_critic_id;
  }

  private isSampleStageBlocked(
    sample: SampleDoc,
    stage: SampleStage,
  ): boolean {
    if (stage === "rubric_gen") return false;
    return sample.rubric_id == null;
  }

  private isScoreUnitStageBlocked(
    unit: SampleEvidenceScoreDoc,
    sample: SampleDoc,
    stage: RunStage,
  ): boolean {
    if (stage === "score_gen") {
      return sample.rubric_id == null;
    }
    return unit.score_id == null || sample.rubric_id == null;
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
    const requestStateIndex = await this.buildRequestStateIndex(
      runId,
      candidateKeys,
      stage,
    );

    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;

      const customKey = this.makeRequestKeyForTarget("sample", sample._id, stage);
      const state = this.classifyRequestState(requestStateIndex, customKey);
      if (state === "pending" || state === "exhausted") continue;

      const inputPayload = await this.buildRubricPayload(stage, sample, config);
      if (!inputPayload) continue;

      pending.push({
        targetId: sample._id,
        input: JSON.stringify(inputPayload),
      });
    }

    return pending;
  }

  private async listPendingSampleEvidenceTargets(
    scoreUnits: SampleEvidenceScoreDoc[],
    stage: RunStage,
    config: ExperimentConfig,
    runId: Id<"runs">,
  ) {
    const pending: Array<{ targetId: string; input: string }> = [];
    const sampleById = await this.mapSamplesByRun(runId);
    const candidateKeys = new Set<string>();
    const unitSamplePairs: Array<{ unit: SampleEvidenceScoreDoc; sample: SampleDoc }> = [];

    for (const unit of scoreUnits) {
      const sample = sampleById.get(String(unit.sample_id));
      if (!sample) continue;
      const outputId = stage === "score_gen" ? unit.score_id : unit.score_critic_id;
      if (outputId) continue;
      if (this.isScoreUnitStageBlocked(unit, sample, stage)) continue;
      unitSamplePairs.push({ unit, sample });
      candidateKeys.add(this.makeRequestKey(unit._id, stage));
    }

    const requestStateIndex = await this.buildRequestStateIndex(
      runId,
      candidateKeys,
      stage,
    );
    const rubricBySampleId = await this.mapRubricsBySampleId(unitSamplePairs);
    const evidenceById = await this.mapEvidenceByUnitId(unitSamplePairs);
    const scoreByUnitId =
      stage === "score_critic" ? await this.mapScoresByUnitId(unitSamplePairs) : new Map();

    for (const { unit, sample } of unitSamplePairs) {
      const customKey = this.makeRequestKey(unit._id, stage);
      const state = this.classifyRequestState(requestStateIndex, customKey);
      if (state === "pending" || state === "exhausted") continue;

      const inputPayload = this.buildScorePayloadForUnit(
        stage,
        sample,
        config,
        rubricBySampleId.get(String(sample._id)),
        evidenceById.get(String(unit._id)),
        scoreByUnitId.get(String(unit._id)),
      );
      if (!inputPayload) continue;

      pending.push({
        targetId: unit._id,
        input: JSON.stringify(inputPayload),
      });
    }

    return pending;
  }

  private async buildRubricPayload(
    stage: RunStage,
    sample: SampleDoc,
    config: ExperimentConfig,
  ): Promise<unknown | null> {
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

  private buildScorePayloadForUnit(
    stage: RunStage,
    sample: SampleDoc,
    config: ExperimentConfig,
    rubric: Doc<"rubrics"> | null | undefined,
    evidence: Doc<"evidences"> | null | undefined,
    score: Doc<"scores"> | null | undefined,
  ): unknown | null {
    if (!sample.rubric_id || !rubric) return null;

    if (stage === "score_gen") {
      if (!evidence) return null;
      return {
        config,
        evidence: {
          l0_raw_content: evidence.l0_raw_content,
          l1_cleaned_content: evidence.l1_cleaned_content,
          l2_neutralized_content: evidence.l2_neutralized_content,
          l3_abstracted_content: evidence.l3_abstracted_content,
        },
        rubric: {
          stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        },
        sample: {
          label_mapping: rubric.label_mapping,
          display_seed: sample.seed,
        },
      };
    }

    if (stage === "score_critic") {
      if (!score) return null;
      if (!evidence) return null;
      const evidenceStrategy = resolveEvidenceStrategy(config);
      const evidenceText =
        evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
      return {
        evidence: evidenceText,
        rubric: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        verdict: buildScoreCriticVerdictSummary({
          decoded_scores: score.decoded_scores,
          rubric_stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
          method: config.scoring_config.method,
          justification: score.justification,
        }),
      };
    }

    return null;
  }

  private async mapRubricsBySampleId(
    pairs: Array<{ unit: SampleEvidenceScoreDoc; sample: SampleDoc }>,
  ): Promise<Map<string, Doc<"rubrics"> | null>> {
    const rubricIds = new Set<string>();
    for (const { sample } of pairs) {
      if (sample.rubric_id) rubricIds.add(String(sample.rubric_id));
    }

    const rubricById = new Map<string, Doc<"rubrics"> | null>();
    for (const rubricId of rubricIds) {
      const rubric = await this.ctx.db.get(rubricId as Id<"rubrics">);
      rubricById.set(rubricId, rubric ?? null);
    }

    const rubricBySampleId = new Map<string, Doc<"rubrics"> | null>();
    for (const { sample } of pairs) {
      if (!sample.rubric_id) {
        rubricBySampleId.set(String(sample._id), null);
        continue;
      }
      rubricBySampleId.set(
        String(sample._id),
        rubricById.get(String(sample.rubric_id)) ?? null,
      );
    }
    return rubricBySampleId;
  }

  private async mapEvidenceByUnitId(
    pairs: Array<{ unit: SampleEvidenceScoreDoc; sample: SampleDoc }>,
  ): Promise<Map<string, Doc<"evidences"> | null>> {
    const evidenceIds = new Set<string>();
    for (const { unit } of pairs) {
      evidenceIds.add(String(unit.evidence_id));
    }

    const evidenceById = new Map<string, Doc<"evidences"> | null>();
    for (const evidenceId of evidenceIds) {
      const evidence = await this.ctx.db.get(evidenceId as Id<"evidences">);
      evidenceById.set(evidenceId, evidence ?? null);
    }

    const evidenceByUnitId = new Map<string, Doc<"evidences"> | null>();
    for (const { unit } of pairs) {
      evidenceByUnitId.set(
        String(unit._id),
        evidenceById.get(String(unit.evidence_id)) ?? null,
      );
    }
    return evidenceByUnitId;
  }

  private async mapScoresByUnitId(
    pairs: Array<{ unit: SampleEvidenceScoreDoc; sample: SampleDoc }>,
  ): Promise<Map<string, Doc<"scores"> | null>> {
    const scoreIds = new Set<string>();
    for (const { unit } of pairs) {
      if (unit.score_id) scoreIds.add(String(unit.score_id));
    }

    const scoreById = new Map<string, Doc<"scores"> | null>();
    for (const scoreId of scoreIds) {
      const score = await this.ctx.db.get(scoreId as Id<"scores">);
      scoreById.set(scoreId, score ?? null);
    }

    const scoreByUnitId = new Map<string, Doc<"scores"> | null>();
    for (const { unit } of pairs) {
      if (!unit.score_id) {
        scoreByUnitId.set(String(unit._id), null);
        continue;
      }
      scoreByUnitId.set(
        String(unit._id),
        scoreById.get(String(unit.score_id)) ?? null,
      );
    }
    return scoreByUnitId;
  }

  private async listScoreUnitsForRun(
    runId: Id<"runs">,
  ): Promise<SampleEvidenceScoreDoc[]> {
    return this.ctx.db
      .query("sample_evidence_scores")
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
