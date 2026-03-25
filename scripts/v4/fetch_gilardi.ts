import path from "node:path";
import {
  V4_SOURCES_ROOT,
  downloadFile,
  ensureDir,
  fetchJson,
  sanitizeFileName,
  writeJson,
} from "./common";

const DATASET_URL =
  "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/PQYF6M";

type DataverseFile = {
  dataFile: {
    id: number;
    filename: string;
    contentType?: string;
    filesize?: number;
  };
};

type DataverseDatasetResponse = {
  data: {
    persistentUrl: string;
    latestVersion: {
      files: DataverseFile[];
    };
  };
};

async function main() {
  const root = path.join(V4_SOURCES_ROOT, "gilardi", "dataverse");
  const filesDir = path.join(root, "files");
  await ensureDir(filesDir);

  const metadata = await fetchJson<DataverseDatasetResponse>(DATASET_URL, {
    headers: {
      "user-agent": "judge-gym-v4-fetcher",
    },
  });
  await writeJson(path.join(root, "dataset_metadata.json"), metadata);

  const downloads: Array<{
    file_id: number;
    filename: string;
    destination: string;
    action: "downloaded" | "skipped";
  }> = [];

  for (const file of metadata.data.latestVersion.files) {
    const filename = file.dataFile.filename;
    const destination = path.join(
      filesDir,
      `${String(file.dataFile.id).padStart(7, "0")}_${sanitizeFileName(filename)}`,
    );
    const result = await downloadFile({
      url: `https://dataverse.harvard.edu/api/access/datafile/${file.dataFile.id}`,
      destinationPath: destination,
    });
    downloads.push({
      file_id: file.dataFile.id,
      filename,
      destination: destination,
      action: result.action,
    });
  }

  await writeJson(path.join(root, "download_manifest.json"), {
    fetched_at: new Date().toISOString(),
    dataset_url: DATASET_URL,
    file_count: downloads.length,
    downloads,
  });

  console.log(
    JSON.stringify(
      {
        source: "gilardi",
        root,
        downloaded: downloads.filter((entry) => entry.action === "downloaded").length,
        total: downloads.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});

