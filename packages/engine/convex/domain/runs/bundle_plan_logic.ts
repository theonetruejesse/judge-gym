import type { Doc } from "../../_generated/dataModel";
import type {
  BundleStrategy,
  SemanticLevel,
} from "../../models/_shared";
import { shuffleWithSeed } from "../../utils/randomize";

type EvidenceDoc = Doc<"evidences">;

export type BundlePlanConfig = {
  strategy: BundleStrategy;
  bundle_size: number;
  seed: number | null;
  source_view: SemanticLevel | null;
};

export type MaterializedBundle = {
  bundle_index: number;
  evidence_ids: string[];
  cluster_id: string | null;
  bundle_signature: string;
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function getEvidenceContentForView(
  evidence: EvidenceDoc,
  view: SemanticLevel | null,
) {
  switch (view) {
    case "l1_cleaned":
      return evidence.l1_cleaned_content ?? evidence.l0_raw_content;
    case "l2_neutralized":
      return evidence.l2_neutralized_content ?? evidence.l1_cleaned_content ?? evidence.l0_raw_content;
    case "l3_abstracted":
      return evidence.l3_abstracted_content ?? evidence.l2_neutralized_content ?? evidence.l1_cleaned_content ?? evidence.l0_raw_content;
    case "l0_raw":
    case null:
    default:
      return evidence.l0_raw_content;
  }
}

function buildWindowRoundRobinSequence(
  evidences: EvidenceDoc[],
  seed: number,
) {
  const shuffledAll = shuffleWithSeed(evidences, seed);
  const byWindow = new Map<string, EvidenceDoc[]>();
  for (const evidence of shuffledAll) {
    const key = String(evidence.window_id);
    const current = byWindow.get(key) ?? [];
    current.push(evidence);
    byWindow.set(key, current);
  }

  const orderedWindowIds = shuffleWithSeed(
    Array.from(byWindow.keys()),
    seed ^ 0x9e3779b9,
  );
  const sequence: EvidenceDoc[] = [];
  let appended = true;
  while (appended) {
    appended = false;
    for (const windowId of orderedWindowIds) {
      const candidates = byWindow.get(windowId) ?? [];
      const next = candidates.shift();
      if (!next) continue;
      sequence.push(next);
      appended = true;
    }
  }

  return sequence;
}

function chunkSequence(
  sequence: EvidenceDoc[],
  bundleSize: number,
) {
  if (bundleSize >= sequence.length) {
    return sequence.length > 0 ? [sequence] : [];
  }

  const bundles: EvidenceDoc[][] = [];
  for (let index = 0; index < sequence.length; index += bundleSize) {
    const bundle = sequence.slice(index, index + bundleSize);
    if (bundle.length > 0) {
      bundles.push(bundle);
    }
  }
  return bundles;
}

function buildBundleSignature(
  evidenceIds: string[],
) {
  return evidenceIds.slice().sort((left, right) => left.localeCompare(right)).join("|");
}

function cosineSimilarity(
  left: Map<string, number>,
  right: Map<string, number>,
) {
  if (left.size === 0 || right.size === 0) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) {
    leftNorm += value * value;
  }
  for (const value of right.values()) {
    rightNorm += value * value;
  }
  const [smaller, larger] = left.size <= right.size ? [left, right] : [right, left];
  for (const [token, value] of smaller.entries()) {
    const rightValue = larger.get(token) ?? 0;
    dot += value * rightValue;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildTfIdfVectors(
  evidences: EvidenceDoc[],
  sourceView: SemanticLevel | null,
) {
  const tokenLists = evidences.map((evidence) => tokenize(getEvidenceContentForView(evidence, sourceView)));
  const documentFrequency = new Map<string, number>();
  for (const tokens of tokenLists) {
    const unique = new Set(tokens);
    for (const token of unique) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const totalDocs = Math.max(1, evidences.length);
  return tokenLists.map((tokens) => {
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }
    const vector = new Map<string, number>();
    for (const [token, count] of termFrequency.entries()) {
      const df = documentFrequency.get(token) ?? 1;
      const idf = Math.log((1 + totalDocs) / (1 + df)) + 1;
      vector.set(token, count * idf);
    }
    return vector;
  });
}

function getBundleCapacities(
  count: number,
  bundleSize: number,
) {
  const bundleCount = Math.ceil(count / Math.max(1, bundleSize));
  const baseSize = Math.floor(count / bundleCount);
  const remainder = count % bundleCount;
  return Array.from({ length: bundleCount }, (_, index) =>
    index < remainder ? baseSize + 1 : baseSize,
  );
}

function buildSemanticClusterBundles(
  evidences: EvidenceDoc[],
  bundleSize: number,
  seed: number,
  sourceView: SemanticLevel | null,
) {
  if (evidences.length === 0) return [] as EvidenceDoc[][];
  if (bundleSize <= 1) return evidences.map((evidence) => [evidence]);
  if (bundleSize >= evidences.length) return [evidences.slice()];

  const vectors = buildTfIdfVectors(evidences, sourceView);
  const shuffledIndices = shuffleWithSeed(
    Array.from({ length: evidences.length }, (_, index) => index),
    seed,
  );
  const shuffledRank = new Map(
    shuffledIndices.map((value, index) => [value, index] as const),
  );
  const bundleCapacities = getBundleCapacities(evidences.length, bundleSize);
  const bundleCount = bundleCapacities.length;

  const centers: number[] = [shuffledIndices[0] ?? 0];
  while (centers.length < bundleCount) {
    let bestIndex = -1;
    let bestDistance = -1;
    for (const candidate of shuffledIndices) {
      if (centers.includes(candidate)) continue;
      let minDistance = Number.POSITIVE_INFINITY;
      for (const center of centers) {
        const similarity = cosineSimilarity(vectors[candidate], vectors[center]);
        const distance = 1 - similarity;
        if (distance < minDistance) minDistance = distance;
      }
      if (
        minDistance > bestDistance
        || (
          minDistance === bestDistance
          && (shuffledRank.get(candidate) ?? Number.MAX_SAFE_INTEGER)
            < (shuffledRank.get(bestIndex) ?? Number.MAX_SAFE_INTEGER)
        )
      ) {
        bestIndex = candidate;
        bestDistance = minDistance;
      }
    }
    if (bestIndex === -1) break;
    centers.push(bestIndex);
  }

  const assignments = new Map<number, number[]>();
  const remainingCapacity = bundleCapacities.slice();
  centers.forEach((center, bundleIndex) => {
    assignments.set(bundleIndex, [center]);
    remainingCapacity[bundleIndex] -= 1;
  });

  const remaining = shuffledIndices
    .filter((index) => !centers.includes(index))
    .sort((left, right) => {
      const leftBest = Math.max(...centers.map((center) => cosineSimilarity(vectors[left], vectors[center])));
      const rightBest = Math.max(...centers.map((center) => cosineSimilarity(vectors[right], vectors[center])));
      if (rightBest !== leftBest) return rightBest - leftBest;
      return (shuffledRank.get(left) ?? 0) - (shuffledRank.get(right) ?? 0);
    });

  for (const index of remaining) {
    const rankedBundles = centers
      .map((center, bundleIndex) => ({
        bundleIndex,
        similarity: cosineSimilarity(vectors[index], vectors[center]),
      }))
      .sort((left, right) => {
        if (right.similarity !== left.similarity) {
          return right.similarity - left.similarity;
        }
        return left.bundleIndex - right.bundleIndex;
      });
    const chosen = rankedBundles.find((bundle) => remainingCapacity[bundle.bundleIndex] > 0);
    if (!chosen) continue;
    const current = assignments.get(chosen.bundleIndex) ?? [];
    current.push(index);
    assignments.set(chosen.bundleIndex, current);
    remainingCapacity[chosen.bundleIndex] -= 1;
  }

  return Array.from({ length: bundleCount }, (_, bundleIndex) => {
    const indices = assignments.get(bundleIndex) ?? [];
    return indices
      .slice()
      .sort((left, right) => {
        const leftScore = cosineSimilarity(vectors[left], vectors[centers[bundleIndex]]);
        const rightScore = cosineSimilarity(vectors[right], vectors[centers[bundleIndex]]);
        if (rightScore !== leftScore) return rightScore - leftScore;
        return String(evidences[left]._id).localeCompare(String(evidences[right]._id));
      })
      .map((index) => evidences[index]);
  }).filter((bundle) => bundle.length > 0);
}

export function materializeBundlesForPlan(
  evidences: EvidenceDoc[],
  config: BundlePlanConfig,
) {
  const bundleSize = Math.max(1, config.bundle_size);
  const seed = config.seed ?? 0;
  switch (config.strategy) {
    case "random_bundle":
      return chunkSequence(
        shuffleWithSeed(evidences, seed),
        bundleSize,
      );
    case "semantic_cluster":
    case "semantic_cluster_projected":
      return buildSemanticClusterBundles(
        evidences,
        bundleSize,
        seed,
        config.source_view,
      );
    case "window_round_robin":
    default:
      return chunkSequence(
        buildWindowRoundRobinSequence(evidences, seed),
        bundleSize,
      );
  }
}

export function buildWindowRoundRobinBundlesForSample(
  evidences: EvidenceDoc[],
  bundleSize: number,
  seed: number,
) {
  return chunkSequence(
    buildWindowRoundRobinSequence(evidences, seed),
    bundleSize,
  );
}

export function materializeBundleRows(
  evidences: EvidenceDoc[],
  config: BundlePlanConfig,
): MaterializedBundle[] {
  return materializeBundlesForPlan(evidences, config).map((bundle, bundleIndex) => {
    const evidenceIds = bundle.map((evidence) => String(evidence._id));
    return {
      bundle_index: bundleIndex,
      evidence_ids: evidenceIds,
      cluster_id: config.strategy === "semantic_cluster" || config.strategy === "semantic_cluster_projected"
        ? `cluster_${bundleIndex + 1}`
        : null,
      bundle_signature: buildBundleSignature(evidenceIds),
    };
  });
}
