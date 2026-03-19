import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

type SmokeResult = {
  ok: boolean;
  status: number;
  dataset: string;
  trace_id: string;
  response_text?: string;
};

function parseJsonFromStdout(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n").map((line) => line.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      return JSON.parse(line);
    } catch {
      // keep scanning
    }
  }
  return JSON.parse(trimmed);
}

function runConvex(functionName: string, payload: object) {
  const localConvexBin = path.join(process.cwd(), "node_modules", ".bin", "convex");
  const hasLocalConvexBin = existsSync(localConvexBin);
  const command = hasLocalConvexBin ? localConvexBin : "npx";
  const args = hasLocalConvexBin
    ? ["run", functionName, JSON.stringify(payload)]
    : ["-y", "convex@latest", "run", functionName, JSON.stringify(payload)];

  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    const stdout = result.stdout?.trim() ?? "";
    throw new Error(`Convex call failed.\nstdout: ${stdout}\nstderr: ${stderr}`);
  }

  return parseJsonFromStdout(result.stdout ?? "");
}

async function main() {
  const result = runConvex("packages/codex:testAxiomIngest", {}) as SmokeResult;

  console.log(`ok: ${result.ok}`);
  console.log(`status: ${result.status}`);
  console.log(`dataset: ${result.dataset}`);
  console.log(`trace_id: ${result.trace_id}`);
  if (result.response_text) {
    console.log(`response: ${result.response_text}`);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
