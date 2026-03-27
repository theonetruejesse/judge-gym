import path from "node:path";
import {
  V4_BUILDS_ROOT,
  V4_SOURCES_ROOT,
  ensureDir,
  readJson,
  readText,
  writeJson,
} from "./common";

type RowsPayload<T> = {
  rows: Array<{
    row: T;
  }>;
};

type HumanRow = {
  question_id: number;
  model_a: string;
  model_b: string;
  winner: string;
  judge: string;
  turn: number;
  conversation_a: Array<{ content: string; role: string }>;
  conversation_b: Array<{ content: string; role: string }>;
};

type JudgePrompt = {
  name: string;
  system_prompt: string;
  prompt_template: string;
};

type QuestionRow = {
  question_id: number;
  category: string;
  turns: string[];
};

function parseJsonl<T>(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    return variables[key] ?? "";
  });
}

function getAssistantContent(
  conversation: HumanRow["conversation_a"],
  assistantIndex: number,
) {
  const assistants = conversation.filter((entry) => entry.role === "assistant");
  return assistants[assistantIndex]?.content ?? "";
}

async function main() {
  const sourceRoot = path.join(V4_SOURCES_ROOT, "zheng");
  const buildRoot = path.join(V4_BUILDS_ROOT, "zheng");
  await ensureDir(buildRoot);

  const humanRowsPayload = await readJson<RowsPayload<HumanRow>>(
    path.join(sourceRoot, "api_rows", "human_rows_25.json"),
  );
  const questionRows = parseJsonl<QuestionRow>(
    await readText(
      path.join(sourceRoot, "FastChat", "fastchat", "llm_judge", "data", "mt_bench", "question.jsonl"),
    ),
  );
  const judgePrompts = parseJsonl<JudgePrompt>(
    await readText(
      path.join(sourceRoot, "FastChat", "fastchat", "llm_judge", "data", "judge_prompts.jsonl"),
    ),
  );

  const questionById = new Map(
    questionRows.map((row) => [row.question_id, row] as const),
  );
  const pairPrompt = judgePrompts.find((prompt) => prompt.name === "pair-v2");
  const pairMultiPrompt = judgePrompts.find((prompt) => prompt.name === "pair-v2-multi-turn");
  if (!pairPrompt || !pairMultiPrompt) {
    throw new Error("Required MT-Bench judge prompts are missing.");
  }

  const turnOneRows = humanRowsPayload.rows
    .map((entry) => entry.row)
    .filter((row) => row.turn === 1)
    .slice(0, 18);
  const turnTwoRows = humanRowsPayload.rows
    .map((entry) => entry.row)
    .filter((row) => row.turn === 2)
    .slice(0, 18);

  const buildEvidenceItems = (
    rows: HumanRow[],
    packagePrefix: string,
    promptTemplate: string,
    turnMode: "single" | "multi",
  ) => rows.map((row, index) => {
    const question = questionById.get(row.question_id);
    const evidenceText = turnMode === "single"
      ? renderTemplate(promptTemplate, {
        question: question?.turns[0] ?? row.conversation_a[0]?.content ?? "",
        answer_a: getAssistantContent(row.conversation_a, 0),
        answer_b: getAssistantContent(row.conversation_b, 0),
      })
      : renderTemplate(promptTemplate, {
        question_1: question?.turns[0] ?? row.conversation_a[0]?.content ?? "",
        question_2: question?.turns[1] ?? row.conversation_a[2]?.content ?? "",
        answer_a_1: getAssistantContent(row.conversation_a, 0),
        answer_a_2: getAssistantContent(row.conversation_a, 1),
        answer_b_1: getAssistantContent(row.conversation_b, 0),
        answer_b_2: getAssistantContent(row.conversation_b, 1),
      });

    return {
      canonical_key: `${packagePrefix}:${row.question_id}:${row.judge}:${index + 1}`,
      title: `MT-Bench Q${row.question_id} ${row.model_a} vs ${row.model_b}`,
      source_url: null,
      source_name: "MT-Bench human judgments",
      publish_date: null,
      raw_text: evidenceText,
      source_record_kind: "paper_original" as const,
      pipeline_kind: "zheng_import",
      pipeline_version: "v1",
      metadata_json: JSON.stringify({
        question_id: row.question_id,
        category: question?.category ?? null,
        model_a: row.model_a,
        model_b: row.model_b,
        winner: row.winner,
        judge: row.judge,
        turn: row.turn,
      }),
      inclusion_reason: "V4 Zheng local import build",
      quality_label: "high" as const,
      ordinal: index,
    };
  });

  const basePackage = {
    target_key: "zheng_mt_bench" as const,
    title: "Zheng MT-Bench pairwise judge package",
    description: "Faithful MT-Bench pairwise judge package derived from FastChat prompts and public judgment rows.",
    default_compatibility_mode: "paper_faithful" as const,
    default_evidence_view: "paper_original" as const,
    rubric_source_kind: "direct_labels" as const,
    task_contract: {
      task_kind: "label_classification" as const,
      label_space_json: JSON.stringify(["A", "B", "C"]),
      instructions_json: JSON.stringify({
        source: "FastChat MT-Bench judge prompts",
        labels: {
          A: "assistant A better",
          B: "assistant B better",
          C: "tie",
        },
      }),
      prompt_template_id: "zheng_mt_bench_pair_v2_v1",
    },
    output_contract: {
      kind: "label" as const,
      schema_version: "v1",
      parser_key: "mt_bench_pairwise_bracket_choice",
    },
    rubric_seed: {
      concept: "pairwise response quality preference",
      scale_size: 3,
      justification: "Direct-label MT-Bench pairwise package.",
      stages: [
        {
          stage_number: 1,
          label: "Assistant A better",
          criteria: ["Assistant A answers better than Assistant B"],
        },
        {
          stage_number: 2,
          label: "Assistant B better",
          criteria: ["Assistant B answers better than Assistant A"],
        },
        {
          stage_number: 3,
          label: "Tie",
          criteria: ["The responses are tied or not meaningfully distinguishable"],
        },
      ],
      label_mapping: {
        A: 1,
        B: 2,
        C: 3,
      },
    },
    rubric_critic_seed: {
      justification: "Imported benchmark labels for a faithful MT-Bench audit.",
      observability_score: 1,
      discriminability_score: 1,
    },
    provenance_json: JSON.stringify({
      fastchat_repo: "https://github.com/lm-sys/FastChat",
      dataset: "lmsys/mt_bench_human_judgments",
    }),
  };

  const pairPackage = {
    package_tag: "zheng_mt_bench_pair_v2_v1",
    ...basePackage,
    score_prompt: {
      template_kind: "simple_v1" as const,
      system_prompt_template: pairPrompt.system_prompt,
      user_prompt_template: "{{evidence}}",
      required_variables: ["evidence"],
    },
    metadata_json: JSON.stringify({
      prompt_name: pairPrompt.name,
      build_kind: "paper_audit_package",
    }),
  };

  const multiTurnPackage = {
    package_tag: "zheng_mt_bench_pair_v2_multi_turn_v1",
    ...basePackage,
    score_prompt: {
      template_kind: "simple_v1" as const,
      system_prompt_template: pairMultiPrompt.system_prompt,
      user_prompt_template: "{{evidence}}",
      required_variables: ["evidence"],
    },
    metadata_json: JSON.stringify({
      prompt_name: pairMultiPrompt.name,
      build_kind: "paper_audit_package",
    }),
  };

  const pairEvidenceItems = buildEvidenceItems(
    turnOneRows,
    "zheng:pair_v2",
    pairPrompt.prompt_template,
    "single",
  );
  const multiEvidenceItems = buildEvidenceItems(
    turnTwoRows,
    "zheng:pair_v2_multi",
    pairMultiPrompt.prompt_template,
    "multi",
  );

  const pairBundle = {
    target: "zheng_mt_bench_pair_v2",
    universe: {
      universe_tag: "zheng_mt_bench_pair_v2_v1",
      kind: "benchmark",
      title: "Zheng MT-Bench pairwise universe",
      description: "Local MT-Bench pair-v2 import bundle.",
      citation_json: JSON.stringify({
        paper: "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena",
        source: "FastChat + lmsys/mt_bench_human_judgments",
      }),
    },
    evidence_set: {
      evidence_set_tag: "zheng_mt_bench_pair_v2_v1_set",
      title: "Zheng MT-Bench pair-v2 canary set",
      source_kind: "literature_dataset",
      quality_label: "high",
      selection_config_json: JSON.stringify({
        split: "human",
        turn: 1,
        row_count: pairEvidenceItems.length,
      }),
    },
    package: pairPackage,
    evidence_items: pairEvidenceItems,
    experiment_blueprints: [
      {
        experiment_tag: "zheng_mt_bench_pair_v2_v1_canary_gpt41",
        package_tag: pairPackage.package_tag,
        study_kind: "benchmark",
        compatibility_mode: "paper_faithful",
        rubric_source_kind: "direct_labels",
        task_contract: pairPackage.task_contract,
        output_contract: pairPackage.output_contract,
        rubric_config: {
          model: "gpt-4.1",
          scale_size: 3,
          concept: "pairwise response quality preference",
        },
        scoring_config: {
          model: "gpt-4.1",
          method: "single",
          abstain_enabled: false,
          evidence_view: "paper_original",
          randomizations: [],
          evidence_bundle_size: 1,
        },
      },
    ],
  };

  const multiTurnBundle = {
    ...pairBundle,
    target: "zheng_mt_bench_pair_v2_multi_turn",
    universe: {
      ...pairBundle.universe,
      universe_tag: "zheng_mt_bench_pair_v2_multi_turn_v1",
      title: "Zheng MT-Bench pairwise multi-turn universe",
    },
    evidence_set: {
      ...pairBundle.evidence_set,
      evidence_set_tag: "zheng_mt_bench_pair_v2_multi_turn_v1_set",
      title: "Zheng MT-Bench pair-v2 multi-turn set",
      selection_config_json: JSON.stringify({
        split: "human",
        turn: 2,
        row_count: multiEvidenceItems.length,
      }),
    },
    package: multiTurnPackage,
    evidence_items: multiEvidenceItems,
    experiment_blueprints: [
      {
        ...pairBundle.experiment_blueprints[0],
        experiment_tag: "zheng_mt_bench_pair_v2_multi_turn_v1_canary_gpt41",
        package_tag: multiTurnPackage.package_tag,
      },
    ],
  };

  await writeJson(path.join(buildRoot, "pair_v2_package.json"), pairPackage);
  await writeJson(path.join(buildRoot, "pair_v2_import_bundle.json"), pairBundle);
  await writeJson(path.join(buildRoot, "pair_v2_multi_turn_package.json"), multiTurnPackage);
  await writeJson(path.join(buildRoot, "pair_v2_multi_turn_import_bundle.json"), multiTurnBundle);

  console.log(JSON.stringify({
    target: "zheng_mt_bench",
    build_root: buildRoot,
    pair_count: pairEvidenceItems.length,
    multi_turn_count: multiEvidenceItems.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
