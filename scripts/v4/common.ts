import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const REPO_ROOT = process.cwd();
export const LOCAL_ROOT = path.join(REPO_ROOT, "_local");
export const V4_SOURCES_ROOT = path.join(LOCAL_ROOT, "v4_sources");
export const V4_BUILDS_ROOT = path.join(LOCAL_ROOT, "v4_builds");

export async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(filePath: string, value: unknown) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function writeText(filePath: string, value: string) {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, value, "utf8");
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.json() as Promise<T>;
}

export async function downloadFile(args: {
  url: string;
  destinationPath: string;
  headers?: Record<string, string>;
  force?: boolean;
}) {
  if (!args.force && await fileExists(args.destinationPath)) {
    return { action: "skipped" as const, destinationPath: args.destinationPath };
  }
  await ensureDir(path.dirname(args.destinationPath));
  const response = await fetch(args.url, {
    headers: {
      "user-agent": "judge-gym-v4-fetcher",
      ...(args.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Download failed ${response.status} for ${args.url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await Bun.write(args.destinationPath, new Uint8Array(arrayBuffer));
  return { action: "downloaded" as const, destinationPath: args.destinationPath };
}

export async function readText(filePath: string) {
  return readFile(filePath, "utf8");
}

export function parseDelimited(args: {
  text: string;
  delimiter: "," | "\t";
}) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    if (row.length === 1 && row[0] === "" && rows.length === 0) {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < args.text.length; index += 1) {
    const char = args.text[index] ?? "";
    const next = args.text[index + 1] ?? "";

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === args.delimiter) {
      pushField();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      pushField();
      pushRow();
      continue;
    }

    field += char;
  }

  pushField();
  if (row.length > 1 || row[0] !== "") {
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }
  const headers = rows[0] ?? [];
  return rows.slice(1).map((values) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    return record;
  });
}

export function sanitizeFileName(name: string) {
  return name.replace(/[^\w.-]+/g, "_");
}

