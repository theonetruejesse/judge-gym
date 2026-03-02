import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { type ModelType } from "../../platform/providers/provider_types";
import { BaseOrchestrator } from "../orchestrator/base";
import {
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

type EvidenceDoc = Doc<"evidences">;
type SampleDoc = Doc<"samples">;
type SampleEvidenceScoreDoc = Doc<"sample_evidence_scores">;

type RequestState = "pending" | "none" | "retryable" | "exhausted";

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

  public nextStageFor(stage: RunStage): RunStage | null {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx === -1) return null;
    return STAGE_ORDER[idx + 1] ?? null;
  }

  private async classifyRequestState(customKey: string): Promise<RequestState> {
    const pendingRequests = await this.ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key_status", (q) =>
        q.eq("custom_key", customKey).eq("status", "pending"),
      )
      .collect();
    if (pendingRequests.length > 0) return "pending";

    const requests = await this.ctx.db
      .query("llm_requests")
      .withIndex("by_custom_key", (q) => q.eq("custom_key", customKey))
      .collect();
    if (requests.length === 0) return "none";

    const maxAttempts = requests.reduce(
      (max, req) => Math.max(max, req.attempts ?? 0),
      0,
    );
    if (maxAttempts >= ENGINE_SETTINGS.run_policy.max_request_attempts) {
      return "exhausted";
    }

    return "retryable";
  }

  public async getStageProgress(
    runId: Id<"runs">,
    stage: RunStage,
  ): Promise<{ completed: number; failed: number; hasPending: boolean } | null> {
    if (!SCORE_STAGES.includes(stage)) {
      return this.getSampleStageProgress(runId, stage);
    }

    const scoreUnits = await this.listScoreUnitsForRun(runId);
    if (scoreUnits.length === 0) {
      // Backward compatibility for runs created before sample_evidence_scores.
      return this.getSampleStageProgress(runId, stage);
    }

    const sampleById = await this.mapSamplesByRun(runId);
    let completed = 0;
    let failed = 0;
    let hasPending = false;

    for (const unit of scoreUnits) {
      const sample = sampleById.get(String(unit.sample_id));
      if (!sample) {
        failed += 1;
        continue;
      }

      const outputId =
        stage === "score_gen" ? unit.score_id : unit.score_critic_id;
      if (outputId) {
        completed += 1;
        continue;
      }

      if (this.isScoreUnitStageBlocked(unit, sample, stage)) {
        failed += 1;
        continue;
      }

      const customKey = this.makeRequestKey(unit._id, stage);
      const state = await this.classifyRequestState(customKey);

      if (state === "pending" || state === "none" || state === "retryable") {
        hasPending = true;
        continue;
      }

      failed += 1;
    }

    return { completed, failed, hasPending };
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
      return this.listPendingSampleTargets(runId, stage, config);
    }

    const scoreUnits = await this.listScoreUnitsForRun(runId);
    if (scoreUnits.length === 0) {
      // Backward compatibility for runs created before sample_evidence_scores.
      return this.listPendingLegacySampleScoreTargets(runId, stage, config);
    }

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
          verdict: string | null;
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
    stage: RunStage,
  ): Promise<{ completed: number; failed: number; hasPending: boolean } | null> {
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    if (samples.length === 0) return null;

    let completed = 0;
    let failed = 0;
    let hasPending = false;

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
      const state = await this.classifyRequestState(customKey);

      if (state === "pending" || state === "none" || state === "retryable") {
        hasPending = true;
        continue;
      }

      failed += 1;
    }

    return { completed, failed, hasPending };
  }

  private getSampleOutputId(sample: SampleDoc, stage: RunStage) {
    if (stage === "rubric_gen") return sample.rubric_id;
    if (stage === "rubric_critic") return sample.rubric_critic_id;
    if (stage === "score_gen") return sample.score_id;
    return sample.score_critic_id;
  }

  private isSampleStageBlocked(sample: SampleDoc, stage: RunStage): boolean {
    if (stage === "rubric_gen") return false;
    if (stage === "rubric_critic") return sample.rubric_id == null;
    if (stage === "score_gen") return sample.rubric_id == null;
    return sample.score_id == null;
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
    stage: RunStage,
    config: ExperimentConfig,
  ) {
    const pending: Array<{ targetId: string; input: string }> = [];
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;

      const customKey = this.makeRequestKeyForTarget("sample", sample._id, stage);
      const state = await this.classifyRequestState(customKey);
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

  private async listPendingLegacySampleScoreTargets(
    runId: Id<"runs">,
    stage: RunStage,
    config: ExperimentConfig,
  ) {
    const pending: Array<{ targetId: string; input: string }> = [];
    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    const run = await this.ctx.db.get(runId);
    if (!run) throw new Error("Run not found");
    const evidenceList = await this.listEvidenceForExperiment(run.experiment_id);

    for (const sample of samples) {
      if (this.getSampleOutputId(sample, stage)) continue;
      if (this.isSampleStageBlocked(sample, stage)) continue;

      const customKey = this.makeRequestKeyForTarget("sample", sample._id, stage);
      const state = await this.classifyRequestState(customKey);
      if (state === "pending" || state === "exhausted") continue;

      const inputPayload = await this.buildLegacyScorePayload(
        stage,
        sample,
        config,
        evidenceList,
      );
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

    for (const unit of scoreUnits) {
      const sample = sampleById.get(String(unit.sample_id));
      if (!sample) continue;

      const outputId =
        stage === "score_gen" ? unit.score_id : unit.score_critic_id;
      if (outputId) continue;
      if (this.isScoreUnitStageBlocked(unit, sample, stage)) continue;

      const customKey = this.makeRequestKey(unit._id, stage);
      const state = await this.classifyRequestState(customKey);
      if (state === "pending" || state === "exhausted") continue;

      const inputPayload = await this.buildScorePayloadForUnit(
        stage,
        unit,
        sample,
        config,
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

  private async buildLegacyScorePayload(
    stage: RunStage,
    sample: SampleDoc,
    config: ExperimentConfig,
    evidenceList: EvidenceDoc[],
  ): Promise<unknown | null> {
    if (stage === "score_gen") {
      if (!sample.rubric_id) return null;
      const rubric = await this.ctx.db.get(sample.rubric_id);
      if (!rubric) return null;
      const evidence = this.pickEvidenceForSample(sample.seed, evidenceList);
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
      if (!sample.score_id || !sample.rubric_id) return null;
      const score = await this.ctx.db.get(sample.score_id);
      const rubric = await this.ctx.db.get(sample.rubric_id);
      if (!score || !rubric) return null;
      const evidence = await this.ctx.db.get(score.evidence_id);
      if (!evidence) return null;
      const evidenceStrategy = resolveEvidenceStrategy(config);
      const evidenceText =
        evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
      const verdict = this.buildVerdictLabel(
        score.decoded_scores,
        rubric.label_mapping,
        config.rubric_config.scale_size,
      );
      return {
        evidence: evidenceText,
        rubric: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        verdict,
      };
    }

    return null;
  }

  private async buildScorePayloadForUnit(
    stage: RunStage,
    unit: SampleEvidenceScoreDoc,
    sample: SampleDoc,
    config: ExperimentConfig,
  ): Promise<unknown | null> {
    if (!sample.rubric_id) return null;
    const rubric = await this.ctx.db.get(sample.rubric_id);
    if (!rubric) return null;

    if (stage === "score_gen") {
      const evidence = await this.ctx.db.get(unit.evidence_id);
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
      if (!unit.score_id) return null;
      const score = await this.ctx.db.get(unit.score_id);
      if (!score) return null;
      const evidence = await this.ctx.db.get(unit.evidence_id);
      if (!evidence) return null;
      const evidenceStrategy = resolveEvidenceStrategy(config);
      const evidenceText =
        evidence[evidenceStrategy.contentField] ?? evidence.l0_raw_content;
      const verdict = this.buildVerdictLabel(
        score.decoded_scores,
        rubric.label_mapping,
        config.rubric_config.scale_size,
      );
      return {
        evidence: evidenceText,
        rubric: rubric.stages.map(({ label, criteria }) => ({ label, criteria })),
        verdict,
      };
    }

    return null;
  }

  private async listEvidenceForExperiment(
    experimentId: Id<"experiments">,
  ): Promise<EvidenceDoc[]> {
    const links = await this.ctx.db
      .query("experiment_evidence")
      .withIndex("by_experiment", (q) => q.eq("experiment_id", experimentId))
      .collect();

    const ordered = links
      .slice()
      .sort((a, b) => a._creationTime - b._creationTime);

    const evidences: EvidenceDoc[] = [];
    for (const link of ordered) {
      const evidence = await this.ctx.db.get(link.evidence_id);
      if (evidence) evidences.push(evidence);
    }
    return evidences;
  }

  private pickEvidenceForSample(seed: number, evidences: EvidenceDoc[]): EvidenceDoc | null {
    if (evidences.length === 0) return null;
    const idx = Math.abs(seed) % evidences.length;
    return evidences[idx] ?? null;
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

  private buildVerdictLabel(
    decodedScores: number[] | null | undefined,
    labelMapping: Record<string, number>,
    stageCount: number,
  ): string | null {
    if (!decodedScores || decodedScores.length === 0) return "ABSTAIN";
    const tokens = new Array<string>(stageCount);
    for (const [token, stage] of Object.entries(labelMapping)) {
      if (stage >= 1 && stage <= stageCount) {
        tokens[stage - 1] = token;
      }
    }
    const resolved = decodedScores
      .map((score) => tokens[score - 1] ?? String.fromCharCode(64 + score))
      .filter(Boolean);
    if (resolved.length === 0) return null;
    if (resolved.length === 1) return resolved[0];
    return resolved.join(", ");
  }

  private makeRequestKeyForTarget(
    targetType: RunRequestTargetType,
    targetId: string,
    stage: RunStage,
  ) {
    return `${targetType}:${targetId}:${stage}`;
  }
}
