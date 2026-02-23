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

const SCORE_STAGES: RunStage[] = ["score_gen", "score_critic"];

type EvidenceDoc = Doc<"evidences">;

export class RunOrchestrator extends BaseOrchestrator<Id<"runs">, RunStage> {
  constructor(ctx: MutationCtx) {
    super(ctx);
  }

  protected async listPendingTargets(
    runId: Id<"runs">,
    stage: RunStage,
  ) {
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

    const samples = await this.ctx.db
      .query("samples")
      .withIndex("by_run", (q) => q.eq("run_id", runId))
      .collect();

    const evidenceList = SCORE_STAGES.includes(stage)
      ? await this.listEvidenceForExperiment(experiment._id)
      : null;

    const pending: Array<{ targetId: Id<"samples">; input: string }> = [];
    for (const sample of samples) {
      if (stage === "rubric_gen" && sample.rubric_id) continue;
      if (stage === "rubric_critic") {
        if (!sample.rubric_id || sample.rubric_critic_id) continue;
      }
      if (stage === "score_gen") {
        if (!sample.rubric_id || sample.score_id) continue;
      }
      if (stage === "score_critic") {
        if (!sample.score_id || sample.score_critic_id) continue;
      }

      const custom_key = this.makeRequestKey(sample._id, stage);
      const pendingRequests = await this.ctx.db
        .query("llm_requests")
        .withIndex("by_custom_key_status", (q) =>
          q.eq("custom_key", custom_key).eq("status", "pending"),
        )
        .collect();
      if (pendingRequests.length > 0) continue;

      const requests = await this.ctx.db
        .query("llm_requests")
        .withIndex("by_custom_key", (q) => q.eq("custom_key", custom_key))
        .collect();
      const maxAttempts = requests.reduce(
        (max, req) => Math.max(max, req.attempts ?? 0),
        0,
      );
      if (maxAttempts >= this.policy.max_request_attempts) continue;

      const inputPayload = await this.buildInputPayload({
        stage,
        sample,
        config,
        evidenceList,
      });
      if (!inputPayload) continue;

      pending.push({
        targetId: sample._id,
        input: JSON.stringify(inputPayload),
      });
    }

    return pending;
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
    return `sample:${targetId}:${stage}`;
  }

  public parseRequestKey(key: string): { targetId: Id<"samples">; stage: RunStage } {
    const [targetType, targetId, stage] = key.split(":");
    if (targetType !== "sample") {
      throw new Error(`Unexpected target type in key: ${key}`);
    }
    return { targetId: targetId as Id<"samples">, stage: stage as RunStage };
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

  private async buildInputPayload(args: {
    stage: RunStage;
    sample: Doc<"samples">;
    config: ExperimentConfig;
    evidenceList: EvidenceDoc[] | null;
  }): Promise<unknown | null> {
    const { stage, sample, config, evidenceList } = args;
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
        rubric: { stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })) },
      };
    }

    if (stage === "score_gen") {
      if (!sample.rubric_id) return null;
      const rubric = await this.ctx.db.get(sample.rubric_id);
      if (!rubric) return null;
      const evidence = this.pickEvidenceForSample(sample.seed, evidenceList ?? []);
      if (!evidence) return null;
      return {
        config,
        evidence: {
          l0_raw_content: evidence.l0_raw_content,
          l1_cleaned_content: evidence.l1_cleaned_content,
          l2_neutralized_content: evidence.l2_neutralized_content,
          l3_abstracted_content: evidence.l3_abstracted_content,
        },
        rubric: { stages: rubric.stages.map(({ label, criteria }) => ({ label, criteria })) },
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
}
