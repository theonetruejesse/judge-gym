import path from "node:path";
import {
  V4_SOURCES_ROOT,
  downloadFile,
  ensureDir,
  fetchJson,
  fileExists,
  writeJson,
} from "./common";

const FASTCHAT_REPO = "https://github.com/lm-sys/FastChat.git";

async function cloneOrUpdateFastChat(destination: string) {
  if (!await fileExists(destination)) {
    const clone = Bun.spawnSync([
      "git",
      "clone",
      "--depth",
      "1",
      FASTCHAT_REPO,
      destination,
    ], {
      stdout: "inherit",
      stderr: "inherit",
    });
    if (clone.exitCode !== 0) {
      throw new Error("Failed to clone FastChat");
    }
    return "cloned";
  }

  const pull = Bun.spawnSync(
    ["git", "-C", destination, "pull", "--ff-only"],
    {
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  if (pull.exitCode !== 0) {
    throw new Error("Failed to update FastChat");
  }
  return "updated";
}

async function main() {
  const root = path.join(V4_SOURCES_ROOT, "zheng");
  const fastChatDir = path.join(root, "FastChat");
  const hfDir = path.join(root, "huggingface");
  const apiDir = path.join(root, "api_rows");

  await ensureDir(root);
  await ensureDir(hfDir);
  await ensureDir(apiDir);

  const gitAction = await cloneOrUpdateFastChat(fastChatDir);

  const hfDownloads = [
    {
      url: "https://huggingface.co/datasets/HuggingFaceH4/mt_bench_prompts/resolve/main/raw/question.jsonl",
      destination: path.join(hfDir, "question.jsonl"),
    },
    {
      url: "https://huggingface.co/datasets/lmsys/mt_bench_human_judgments/resolve/main/data/human-00000-of-00001-25f4910818759289.parquet",
      destination: path.join(hfDir, "human_judgments.parquet"),
    },
    {
      url: "https://huggingface.co/datasets/lmsys/mt_bench_human_judgments/resolve/main/data/gpt4_pair-00000-of-00001-c0b431264a82ddc0.parquet",
      destination: path.join(hfDir, "gpt4_pair.parquet"),
    },
  ];

  const downloadResults = [];
  for (const item of hfDownloads) {
    const result = await downloadFile({
      url: item.url,
      destinationPath: item.destination,
    });
    downloadResults.push({
      url: item.url,
      destination: item.destination,
      action: result.action,
    });
  }

  const humanRows = await fetchJson(
    "https://datasets-server.huggingface.co/rows?dataset=lmsys%2Fmt_bench_human_judgments&config=default&split=human&offset=0&length=25",
  );
  const promptRows = await fetchJson(
    "https://datasets-server.huggingface.co/rows?dataset=HuggingFaceH4%2Fmt_bench_prompts&config=default&split=train&offset=0&length=80",
  );
  await writeJson(path.join(apiDir, "human_rows_25.json"), humanRows);
  await writeJson(path.join(apiDir, "prompt_rows_80.json"), promptRows);

  await writeJson(path.join(root, "source_manifest.json"), {
    fetched_at: new Date().toISOString(),
    fastchat_repo: FASTCHAT_REPO,
    fastchat_action: gitAction,
    huggingface_downloads: downloadResults,
    api_rows: [
      path.join(apiDir, "human_rows_25.json"),
      path.join(apiDir, "prompt_rows_80.json"),
    ],
  });

  console.log(JSON.stringify({
    source: "zheng",
    root,
    fastchat_action: gitAction,
    huggingface_downloads: downloadResults,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

