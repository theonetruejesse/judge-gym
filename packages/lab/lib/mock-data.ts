// ─── Types ──────────────────────────────────────────────────────────────────

export type TaskType = "ecc" | "control" | "benchmark";
export type ExperimentStatus =
  | "pending"
  | "running"
  | "paused"
  | "complete"
  | "canceled";
export type EvidenceView =
  | "l0_raw"
  | "l1_cleaned"
  | "l2_neutralized"
  | "l3_abstracted";
export type ModelId =
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-5.2"
  | "gpt-5.2-chat"
  | "claude-sonnet-4.5"
  | "claude-haiku-4.5";
export type RunStatus =
  | "pending"
  | "running"
  | "paused"
  | "complete"
  | "canceled";

export interface ExperimentWindow {
  concept: string;
  country: string;
  startDate: string;
  endDate: string;
}

export interface MockStage {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  progress: number;
}

export interface MockRun {
  id: string;
  status: RunStatus;
  progress: number;
  totalSamples: number;
  completedSamples: number;
  startedAt: string;
  completedAt?: string;
  stages: MockStage[];
}

export interface MockExperiment {
  id: string;
  tag: string;
  concept: string;
  taskType: TaskType;
  status: ExperimentStatus;
  rubricModel: ModelId;
  scoringModel: ModelId;
  scaleSize: 3 | 4 | 5;
  evidenceView: EvidenceView;
  scoringMethod: string;
  promptOrdering: string;
  abstainEnabled: boolean;
  randomizations: string[];
  window: ExperimentWindow;
  runs: MockRun[];
  createdAt: string;
}

export interface MockEvidence {
  id: string;
  experimentId: string;
  concept: string;
  view: EvidenceView;
  title: string;
  sourceUrl: string;
  snippet: string;
  collectedAt: string;
}

export interface MockEvidenceContent {
  evidenceId: string;
  raw: string;
  l1_cleaned: string;
  l2_neutralized: string;
  l3_abstracted: string;
}

// ─── Mock Experiments ───────────────────────────────────────────────────────

export const EXPERIMENTS: MockExperiment[] = [
  {
    id: "exp_001",
    tag: "ecc-gpt41-neutralized-5pt",
    concept: "climate_change",
    taskType: "ecc",
    status: "running",
    rubricModel: "gpt-4.1",
    scoringModel: "claude-sonnet-4.5",
    scaleSize: 5,
    evidenceView: "l2_neutralized",
    scoringMethod: "rubric_guided",
    promptOrdering: "evidence_first",
    abstainEnabled: true,
    randomizations: ["evidence_order", "scale_direction"],
    window: {
      concept: "climate_change",
      country: "US",
      startDate: "2025-01-01",
      endDate: "2025-06-30",
    },
    runs: [
      {
        id: "run_001a",
        status: "running",
        progress: 67,
        totalSamples: 150,
        completedSamples: 100,
        startedAt: "2026-02-14T08:00:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "evidence_neutralize", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "score_gen", status: "running", progress: 67 },
        ],
      },
    ],
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "exp_002",
    tag: "ecc-sonnet-cleaned-4pt",
    concept: "inflation",
    taskType: "ecc",
    status: "complete",
    rubricModel: "claude-sonnet-4.5",
    scoringModel: "claude-sonnet-4.5",
    scaleSize: 4,
    evidenceView: "l1_cleaned",
    scoringMethod: "rubric_guided",
    promptOrdering: "rubric_first",
    abstainEnabled: false,
    randomizations: ["evidence_order"],
    window: {
      concept: "inflation",
      country: "UK",
      startDate: "2025-03-01",
      endDate: "2025-09-30",
    },
    runs: [
      {
        id: "run_002a",
        status: "complete",
        progress: 100,
        totalSamples: 200,
        completedSamples: 200,
        startedAt: "2026-01-20T14:00:00Z",
        completedAt: "2026-01-21T02:30:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "rubric_critic", status: "complete", progress: 100 },
          { name: "score_gen", status: "complete", progress: 100 },
        ],
      },
    ],
    createdAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "exp_003",
    tag: "control-gpt41mini-raw-3pt",
    concept: "immigration",
    taskType: "control",
    status: "complete",
    rubricModel: "gpt-4.1-mini",
    scoringModel: "gpt-4.1",
    scaleSize: 3,
    evidenceView: "l0_raw",
    scoringMethod: "direct",
    promptOrdering: "evidence_first",
    abstainEnabled: false,
    randomizations: [],
    window: {
      concept: "immigration",
      country: "DE",
      startDate: "2025-02-01",
      endDate: "2025-08-31",
    },
    runs: [
      {
        id: "run_003a",
        status: "complete",
        progress: 100,
        totalSamples: 80,
        completedSamples: 80,
        startedAt: "2026-02-01T11:00:00Z",
        completedAt: "2026-02-01T18:45:00Z",
        stages: [
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "score_gen", status: "complete", progress: 100 },
        ],
      },
    ],
    createdAt: "2026-01-28T16:00:00Z",
  },
  {
    id: "exp_004",
    tag: "control-haiku-abstracted-5pt",
    concept: "healthcare",
    taskType: "control",
    status: "running",
    rubricModel: "claude-haiku-4.5",
    scoringModel: "gpt-5.2",
    scaleSize: 5,
    evidenceView: "l3_abstracted",
    scoringMethod: "rubric_guided",
    promptOrdering: "interleaved",
    abstainEnabled: true,
    randomizations: ["evidence_order", "scale_direction", "rubric_shuffle"],
    window: {
      concept: "healthcare",
      country: "CA",
      startDate: "2025-04-01",
      endDate: "2025-10-31",
    },
    runs: [
      {
        id: "run_004a",
        status: "running",
        progress: 34,
        totalSamples: 120,
        completedSamples: 41,
        startedAt: "2026-02-13T20:00:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "evidence_neutralize", status: "complete", progress: 100 },
          { name: "evidence_abstract", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "running", progress: 68 },
          { name: "score_gen", status: "pending", progress: 0 },
        ],
      },
    ],
    createdAt: "2026-02-05T08:30:00Z",
  },
  {
    id: "exp_005",
    tag: "benchmark-gpt52-neutralized-5pt",
    concept: "energy_policy",
    taskType: "benchmark",
    status: "pending",
    rubricModel: "gpt-5.2",
    scoringModel: "gpt-5.2",
    scaleSize: 5,
    evidenceView: "l2_neutralized",
    scoringMethod: "rubric_guided",
    promptOrdering: "evidence_first",
    abstainEnabled: true,
    randomizations: ["evidence_order", "scale_direction"],
    window: {
      concept: "energy_policy",
      country: "JP",
      startDate: "2025-05-01",
      endDate: "2025-11-30",
    },
    runs: [],
    createdAt: "2026-02-12T14:00:00Z",
  },
  {
    id: "exp_006",
    tag: "benchmark-sonnet-cleaned-4pt",
    concept: "trade_policy",
    taskType: "benchmark",
    status: "paused",
    rubricModel: "claude-sonnet-4.5",
    scoringModel: "claude-haiku-4.5",
    scaleSize: 4,
    evidenceView: "l1_cleaned",
    scoringMethod: "direct",
    promptOrdering: "rubric_first",
    abstainEnabled: false,
    randomizations: ["scale_direction"],
    window: {
      concept: "trade_policy",
      country: "BR",
      startDate: "2025-06-01",
      endDate: "2025-12-31",
    },
    runs: [
      {
        id: "run_006a",
        status: "paused",
        progress: 45,
        totalSamples: 180,
        completedSamples: 81,
        startedAt: "2026-02-10T09:00:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "score_gen", status: "running", progress: 45 },
        ],
      },
    ],
    createdAt: "2026-02-08T11:00:00Z",
  },
  {
    id: "exp_007",
    tag: "ecc-gpt52chat-neutralized-3pt",
    concept: "digital_privacy",
    taskType: "ecc",
    status: "canceled",
    rubricModel: "gpt-5.2-chat",
    scoringModel: "gpt-5.2-chat",
    scaleSize: 3,
    evidenceView: "l2_neutralized",
    scoringMethod: "rubric_guided",
    promptOrdering: "evidence_first",
    abstainEnabled: true,
    randomizations: ["evidence_order"],
    window: {
      concept: "digital_privacy",
      country: "FR",
      startDate: "2025-01-15",
      endDate: "2025-07-15",
    },
    runs: [
      {
        id: "run_007a",
        status: "canceled",
        progress: 12,
        totalSamples: 100,
        completedSamples: 12,
        startedAt: "2026-02-06T16:00:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "evidence_neutralize", status: "error", progress: 60 },
        ],
      },
    ],
    createdAt: "2026-02-04T07:00:00Z",
  },
  {
    id: "exp_008",
    tag: "control-gpt41-cleaned-5pt",
    concept: "education",
    taskType: "control",
    status: "complete",
    rubricModel: "gpt-4.1",
    scoringModel: "gpt-4.1-mini",
    scaleSize: 5,
    evidenceView: "l1_cleaned",
    scoringMethod: "rubric_guided",
    promptOrdering: "rubric_first",
    abstainEnabled: true,
    randomizations: ["evidence_order", "rubric_shuffle"],
    window: {
      concept: "education",
      country: "AU",
      startDate: "2025-02-15",
      endDate: "2025-08-15",
    },
    runs: [
      {
        id: "run_008a",
        status: "complete",
        progress: 100,
        totalSamples: 90,
        completedSamples: 90,
        startedAt: "2026-01-25T10:00:00Z",
        completedAt: "2026-01-25T22:15:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "rubric_critic", status: "complete", progress: 100 },
          { name: "score_gen", status: "complete", progress: 100 },
          { name: "score_critic", status: "complete", progress: 100 },
        ],
      },
      {
        id: "run_008b",
        status: "complete",
        progress: 100,
        totalSamples: 90,
        completedSamples: 90,
        startedAt: "2026-02-02T08:00:00Z",
        completedAt: "2026-02-02T19:30:00Z",
        stages: [
          { name: "evidence_clean", status: "complete", progress: 100 },
          { name: "rubric_gen", status: "complete", progress: 100 },
          { name: "score_gen", status: "complete", progress: 100 },
        ],
      },
    ],
    createdAt: "2026-01-20T13:00:00Z",
  },
];

// ─── Mock Evidence ──────────────────────────────────────────────────────────

export const EVIDENCE: MockEvidence[] = [
  {
    id: "ev_001",
    experimentId: "exp_001",
    concept: "climate_change",
    view: "l2_neutralized",
    title: "Global Temperature Anomalies Report 2025",
    sourceUrl: "https://climate.gov/reports/temp-anomalies-2025",
    snippet:
      "Surface temperatures showed a continued deviation from the 1951-1980 baseline average, with regional variation across hemispheres...",
    collectedAt: "2026-01-16T12:00:00Z",
  },
  {
    id: "ev_002",
    experimentId: "exp_001",
    concept: "climate_change",
    view: "l2_neutralized",
    title: "Carbon Emissions Quarterly Summary Q4",
    sourceUrl: "https://iea.org/data/emissions-q4-2025",
    snippet:
      "Quarterly emissions data indicates a marginal shift in trajectory compared to prior periods, with sectoral contributions varying by region...",
    collectedAt: "2026-01-16T12:05:00Z",
  },
  {
    id: "ev_003",
    experimentId: "exp_001",
    concept: "climate_change",
    view: "l0_raw",
    title: "Reuters: UN Climate Summit Coverage",
    sourceUrl: "https://reuters.com/world/environment/un-climate-summit-2025",
    snippet:
      "Delegates from 190 nations convened for the annual climate summit, with discussions centering on financing mechanisms and emission targets for developing economies...",
    collectedAt: "2026-01-16T12:10:00Z",
  },
  {
    id: "ev_004",
    experimentId: "exp_002",
    concept: "inflation",
    view: "l1_cleaned",
    title: "UK CPI Monthly Bulletin — August 2025",
    sourceUrl: "https://ons.gov.uk/economy/inflation/aug2025",
    snippet:
      "The Consumer Price Index rose by 0.3% month-on-month. Housing and food categories contributed most to the headline figure...",
    collectedAt: "2026-01-12T09:00:00Z",
  },
  {
    id: "ev_005",
    experimentId: "exp_002",
    concept: "inflation",
    view: "l1_cleaned",
    title: "Bank of England Interest Rate Decision Minutes",
    sourceUrl: "https://bankofengland.co.uk/minutes/2025/q3",
    snippet:
      "The Monetary Policy Committee voted 6-3 to hold the base rate. Members cited persistent services inflation and softening demand signals...",
    collectedAt: "2026-01-12T09:15:00Z",
  },
  {
    id: "ev_006",
    experimentId: "exp_003",
    concept: "immigration",
    view: "l0_raw",
    title: "Bundesamt Migration Statistics H1 2025",
    sourceUrl: "https://bamf.de/stats/migration-h1-2025",
    snippet:
      "Asylum applications in the first half of 2025 totaled 142,300, a 12% decrease from the same period in 2024. Processing times improved by an average of 3 weeks...",
    collectedAt: "2026-01-30T15:00:00Z",
  },
  {
    id: "ev_007",
    experimentId: "exp_004",
    concept: "healthcare",
    view: "l3_abstracted",
    title: "Canadian Healthcare Wait Times Analysis",
    sourceUrl: "https://cihi.ca/en/wait-times-2025",
    snippet:
      "Median wait times for specialist referrals varied from 4.2 to 18.7 weeks depending on province and specialty. Emergency department volumes remained elevated...",
    collectedAt: "2026-02-06T10:00:00Z",
  },
  {
    id: "ev_008",
    experimentId: "exp_004",
    concept: "healthcare",
    view: "l3_abstracted",
    title: "WHO Universal Health Coverage Progress Report",
    sourceUrl: "https://who.int/publications/uhc-progress-2025",
    snippet:
      "Global UHC service coverage index reached 80 in 2025, up from 78 in 2023. Gaps remain in mental health services and rural primary care access...",
    collectedAt: "2026-02-06T10:30:00Z",
  },
  {
    id: "ev_009",
    experimentId: "exp_006",
    concept: "trade_policy",
    view: "l1_cleaned",
    title: "Brazil-Mercosur Trade Volume Update",
    sourceUrl: "https://mdic.gov.br/trade/mercosur-2025",
    snippet:
      "Intra-bloc trade volumes rose 8.3% year-over-year, driven by agricultural exports. The new digital trade chapter entered provisional application...",
    collectedAt: "2026-02-09T08:00:00Z",
  },
  {
    id: "ev_010",
    experimentId: "exp_007",
    concept: "digital_privacy",
    view: "l2_neutralized",
    title: "CNIL Annual Enforcement Report 2025",
    sourceUrl: "https://cnil.fr/en/enforcement-report-2025",
    snippet:
      "The Commission issued 47 formal notices and 12 financial penalties during the reporting period. Cross-border data transfer cases constituted 34% of investigations...",
    collectedAt: "2026-02-05T14:00:00Z",
  },
  {
    id: "ev_011",
    experimentId: "exp_008",
    concept: "education",
    view: "l1_cleaned",
    title: "OECD Education at a Glance 2025 — Australia",
    sourceUrl: "https://oecd.org/education/eag-2025-australia",
    snippet:
      "Tertiary attainment among 25-34 year-olds reached 58%, above the OECD average. Public expenditure on education as a share of GDP was 4.9%...",
    collectedAt: "2026-01-22T11:00:00Z",
  },
  {
    id: "ev_012",
    experimentId: "exp_005",
    concept: "energy_policy",
    view: "l2_neutralized",
    title: "Japan Energy Mix Projection FY2025",
    sourceUrl: "https://meti.go.jp/english/energy/mix-fy2025",
    snippet:
      "Renewable sources accounted for 24.8% of total electricity generation, with solar PV contributing the largest share. Nuclear restart progress remained gradual...",
    collectedAt: "2026-02-13T07:00:00Z",
  },
  {
    id: "ev_013",
    experimentId: "exp_008",
    concept: "education",
    view: "l1_cleaned",
    title: "NAPLAN Results Summary — 2025",
    sourceUrl: "https://nap.edu.au/naplan/results-2025",
    snippet:
      "Year 5 reading scores improved by 3.2% nationally. Numeracy scores were stable. The gap between metropolitan and remote students narrowed slightly...",
    collectedAt: "2026-01-22T11:30:00Z",
  },
];

// ─── Mock Evidence Content ─────────────────────────────────────────────────

const EVIDENCE_CONTENT: Record<string, MockEvidenceContent> = {
  ev_001: {
    evidenceId: "ev_001",
    raw:
      "Global Temperature Anomalies Report 2025\n\nSurface temperatures showed a continued deviation from the 1951-1980 baseline average, with regional variation across hemispheres. The report includes station-by-station raw observations, satellite telemetry, and the seasonal adjustment notes used by NOAA.\n\nSource: https://climate.gov/reports/temp-anomalies-2025",
    l1_cleaned:
      "Surface temperatures remained above the 1951-1980 baseline with clear regional variation. The report consolidates station observations and satellite telemetry, removing duplicate station entries and normalizing timestamps.",
    l2_neutralized:
      "The report documents temperature deviations relative to the 1951-1980 baseline across regions. It includes observations, satellite measurements, and methodology notes without evaluative language.",
    l3_abstracted:
      "Observed temperatures in 2025 deviated from the 1951-1980 baseline across regions, based on consolidated ground and satellite data.",
  },
  ev_003: {
    evidenceId: "ev_003",
    raw:
      "Reuters: UN Climate Summit Coverage\n\nDelegates from 190 nations convened for the annual climate summit, focusing on financing mechanisms and emission targets for developing economies. Several blocs issued competing draft statements as negotiations continued.\n\nSource: https://reuters.com/world/environment/un-climate-summit-2025",
    l1_cleaned:
      "Delegates from 190 nations convened for the annual climate summit, focusing on financing mechanisms and emission targets. Draft statements were circulated as negotiations continued.",
    l2_neutralized:
      "The summit involved negotiations among 190 nations around financing mechanisms and emission targets. Multiple draft statements were circulated during the meeting.",
    l3_abstracted:
      "The summit centered on financing mechanisms and emission targets, with multiple draft statements under negotiation.",
  },
  ev_007: {
    evidenceId: "ev_007",
    raw:
      "Canadian Healthcare Wait Times Analysis\n\nMedian wait times for specialist referrals varied by province and specialty. Emergency department volumes remained elevated and varied across regions.\n\nSource: https://cihi.ca/en/wait-times-2025",
    l1_cleaned:
      "Median specialist referral wait times varied by province and specialty. Emergency department volumes remained elevated across regions.",
    l2_neutralized:
      "The analysis reports variation in referral wait times across provinces and specialties, along with elevated emergency department volumes.",
    l3_abstracted:
      "Wait times and emergency department volumes varied across Canadian regions in 2025.",
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getEvidenceForExperiment(experimentId: string): MockEvidence[] {
  return EVIDENCE.filter((e) => e.experimentId === experimentId);
}

export function getEvidenceById(id: string): MockEvidence | undefined {
  return EVIDENCE.find((e) => e.id === id);
}

export function getExperimentById(
  id: string,
): MockExperiment | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}

function buildEvidenceContent(evidence: MockEvidence): MockEvidenceContent {
  const base = `${evidence.title}\n\n${evidence.snippet}\n\nSource: ${evidence.sourceUrl}`;
  return {
    evidenceId: evidence.id,
    raw: `${base}\n\nRaw ingestion excerpt: ${evidence.snippet}`,
    l1_cleaned:
      `${evidence.snippet} (cleaned for formatting, punctuation, and duplicate lines).`,
    l2_neutralized:
      `Neutral summary: ${evidence.snippet} The phrasing is standardized to remove evaluative language.`,
    l3_abstracted:
      `Abstracted statement: ${evidence.snippet.split(".")[0] ?? evidence.snippet}.`,
  };
}

export function getEvidenceContentById(
  id: string,
): MockEvidenceContent | undefined {
  const evidence = getEvidenceById(id);
  if (!evidence) return undefined;
  return EVIDENCE_CONTENT[id] ?? buildEvidenceContent(evidence);
}

export const STATUS_COLORS: Record<ExperimentStatus | RunStatus, string> = {
  running: "#22c55e",
  complete: "#3b82f6",
  paused: "#f59e0b",
  pending: "#6b7280",
  canceled: "#ef4444",
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  ecc: "ECC",
  control: "Control",
  benchmark: "Benchmark",
};

export const VIEW_LABELS: Record<EvidenceView, string> = {
  l0_raw: "L0 Raw",
  l1_cleaned: "L1 Cleaned",
  l2_neutralized: "L2 Neutralized",
  l3_abstracted: "L3 Abstracted",
};

export const NORMALIZATION_LEVELS: { key: EvidenceView; label: string }[] = [
  { key: "l0_raw", label: "L0 Raw" },
  { key: "l1_cleaned", label: "L1 Cleaned" },
  { key: "l2_neutralized", label: "L2 Neutralized" },
  { key: "l3_abstracted", label: "L3 Abstracted" },
];
