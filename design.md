# Mission Control — Design Specification

## 1. Design Philosophy

**Mental model:** Spatial selection + tabbed detail panel. Researcher selects an experiment from a persistent sidebar list, then inspects its configuration, runs, and evidence through tabbed content in the main area. Information density is high — this is a monitoring dashboard, not a marketing page.

**Tone:** Industrial/utilitarian. Dense, quiet, professional. Designed for long sessions of checking experiment status and reading evidence. No decorative elements. Every pixel conveys information.

**Interaction model:** Click-to-select in sidebar, tab-to-switch in detail panel. Status filter toggle chips in sidebar. All data is immediately visible without scrolling for a typical experiment. No modals, no overlays, no popovers (except where strictly necessary for future features).

---

## 2. Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (h-11, 44px)                                        │
│ LEFT: brand + title   RIGHT: summary counts                 │
├──────────────┬──────────────────────────────────────────────┤
│ Sidebar      │ Main Content                                 │
│ (w-64, 256px)│                                              │
│              │ Experiment Header                             │
│ Filters      │   tag, id, created, status badge, actions    │
│ ─────────    │                                              │
│ Experiment   │ Tab Bar                                      │
│ List         │   Configuration | Runs (n) | Evidence (n)    │
│ (scrollable) │ ─────────────────────────────────────────    │
│              │ Tab Content (scrollable)                      │
│              │   - Config: key-value table                   │
│              │   - Runs: cards with stage tables             │
│              │   - Evidence: table with title+snippet        │
│              │                                              │
├──────────────┴──────────────────────────────────────────────┤
│ Status Bar (h-7, 28px)                                      │
│ LEFT: filter count, evidence count   RIGHT: sync status     │
└─────────────────────────────────────────────────────────────┘
```

- **Fixed full-viewport** — `fixed inset-0`, no page scroll. Sidebar and main content scroll independently.
- **Three horizontal bands** — top bar, body (sidebar + main), status bar.
- **Sidebar** — fixed 256px width, does not resize. Contains filter section (border-bottom separated) and scrollable experiment list.
- **Main content** — fills remaining width. Contains experiment header, tab bar, and scrollable tab content area.

---

## 3. Typography

| Role                         | Font           | Weight        | Size             | Tracking                                                          |
| ---------------------------- | -------------- | ------------- | ---------------- | ----------------------------------------------------------------- |
| **Data / body**              | JetBrains Mono | 400, 500      | 13px base        | Default                                                           |
| **Headings / labels**        | Bitter (serif) | 400, 600, 700 | Varies           | `tracking-tight` for titles, `tracking-widest` for section labels |
| **Brand title**              | Bitter         | 700           | 14px (`text-sm`) | `tracking-wide`                                                   |
| **Experiment tag (sidebar)** | JetBrains Mono | 500           | 12px (`text-xs`) | Default                                                           |
| **Experiment tag (header)**  | Bitter         | 700           | 20px (`text-xl`) | `tracking-tight`                                                  |
| **Table headers**            | JetBrains Mono | 600           | 10px             | `tracking-wider`, uppercase                                       |
| **Table cells**              | JetBrains Mono | 400           | 12px (`text-xs`) | Default                                                           |
| **Meta text**                | JetBrains Mono | 400           | 10–11px          | Default                                                           |
| **Filter chips**             | JetBrains Mono | 400           | 10px             | `tracking-wider`, uppercase                                       |
| **Tab labels**               | Bitter         | 600           | 12px (`text-xs`) | `tracking-wider`, uppercase                                       |
| **Status bar**               | JetBrains Mono | 400           | 10px             | Default                                                           |

**Loading via `next/font/google`:**

```typescript
const serif = Bitter({ subsets: ["latin"], weight: ["400", "600", "700"] });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"] });
```

The root wrapper uses `mono.className` so JetBrains Mono is the default. Bitter is applied selectively via `serif.className` on headings, labels, tabs, and the brand mark.

---

## 4. Color Palette

### Backgrounds (darkest to lightest)

| Token         | Hex         | Usage                                                    |
| ------------- | ----------- | -------------------------------------------------------- |
| `bg-deepest`  | `#0b0e14`   | Top bar, sidebar, status bar                             |
| `bg-base`     | `#0f1219`   | Main content area, body default                          |
| `bg-surface`  | `#0b0e1499` | Cards, table containers (with alpha for subtle layering) |
| `bg-selected` | `#151a24`   | Selected sidebar item, inactive filter chips             |

### Borders

| Token            | Hex       | Usage                                                     |
| ---------------- | --------- | --------------------------------------------------------- |
| `border-primary` | `#1e2433` | All structural borders — sidebar, tabs, table rows, cards |

### Text

| Token          | Hex       | Opacity   | Usage                                                                       |
| -------------- | --------- | --------- | --------------------------------------------------------------------------- |
| `text-bright`  | `#e8eaed` | 1.0       | Primary content — experiment tags, table values                             |
| `text-default` | `#c8ccd4` | 1.0       | Body text default                                                           |
| `text-muted`   | `#7a8599` | 1.0       | View level badges                                                           |
| `text-label`   | `#5a6173` | 1.0       | Table header labels, inactive tabs, config row labels                       |
| `text-dim`     | `#3a4050` | 1.0       | Table sub-headers, status bar text                                          |
| Various        | —         | 0.40–0.60 | Metadata, timestamps, snippets (via `opacity-40`/`opacity-50`/`opacity-60`) |

### Accent

| Token            | Hex       | Usage                                                                                                                      |
| ---------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| `accent-primary` | `#ff6b35` | Brand mark, selected tab underline, selected sidebar item text, Run button bg, progress bar (in-progress), percentage text |

### Status Colors

| Status     | Hex                   | Used as                                |
| ---------- | --------------------- | -------------------------------------- |
| `running`  | `#22c55e` (green-500) | Dot, badge bg+text (at 20%/100% alpha) |
| `complete` | `#3b82f6` (blue-500)  | Dot, badge, progress bar when 100%     |
| `paused`   | `#f59e0b` (amber-500) | Dot, badge                             |
| `pending`  | `#6b7280` (gray-500)  | Dot, badge                             |
| `canceled` | `#ef4444` (red-500)   | Dot, badge                             |
| `error`    | `#ef4444` (red-500)   | Stage status dot                       |

Status badges use the color at `20` hex alpha for background and full color for text, e.g. `backgroundColor: "#22c55e20"`, `color: "#22c55e"`.

---

## 5. Component Inventory

### 5.1 StatusDot

Small 8×8px (`h-2 w-2`) filled circle. Color from `STATUS_COLORS` map. Used in sidebar list items, run headers, and stage rows.

### 5.2 ProgressBar

Height 6px (`h-1.5`), rounded-full, white/10 background track. Fill bar transitions width with `duration-500`. Color: `#ff6b35` when < 100%, `#3b82f6` when complete.

### 5.3 Filter Chips

Horizontal flex-wrap row of toggle buttons. Each shows a status name (uppercase, 10px). Active state: status color at 30% alpha bg, 50% alpha border, full color text. Inactive state: `#151a24` bg, `#1e2433` border, `#5a6173` text.

### 5.4 Sidebar Experiment Item

Full-width button, `px-3 py-2.5`, bottom border. Contains:

- Row 1: StatusDot + tag name (12px, medium weight). Selected: `#ff6b35` text. Unselected: `#c8ccd4`.
- Row 2: Task type label + country + scale (10px, opacity-40), indented 16px (`ml-4`).
  Selected bg: `#151a24`. Unselected: transparent.

### 5.5 Tab Bar

Horizontal row of buttons flush against a bottom border. Each tab: Bitter font, 12px uppercase tracking-wider, `px-4 py-2`. Active: `#ff6b35` 2px bottom border + `#ff6b35` text. Inactive: transparent border + `#5a6173` text. Runs and Evidence tabs append `(count)`.

### 5.6 ConfigPanel

Borderless two-column `<table>` inside a rounded bordered container (`#1e2433` border, `#0b0e1499` bg). Left column: 192px fixed width, label (11px uppercase tracking-wider, `#5a6173`). Right column: value (12px, `#e8eaed`). Rows separated by `#1e2433` borders.

**Config fields displayed:**

1. Task Type
2. Rubric Model
3. Scoring Model
4. Scale Size (formatted as "N-point")
5. Evidence View
6. Scoring Method
7. Prompt Ordering
8. Abstain Enabled (Yes/No)
9. Randomizations (comma-joined or "None")
10. Window Concept
11. Window Country
12. Window Period (startDate → endDate)

### 5.7 RunsPanel

Vertical stack of run cards (space-y-4). Each card: rounded bordered container. Header row: StatusDot + run ID + sample count | ProgressBar (w-32) + percentage. Below: stages table with 3 columns (Stage, Status with dot, Progress %).

Empty state: centered text "No runs yet. Click Run to start one." inside bordered container.

### 5.8 EvidencePanel

Single bordered container with `<table>`. Columns: Title (with snippet below), View (badge), Source (URL, truncated), Collected (date). Title is 12px bright text; snippet is 11px opacity-40, `line-clamp-2`. View badge: `#151a24` bg, `#7a8599` text, rounded, 10px.

Empty state: centered text inside bordered container.

### 5.9 Action Buttons

- **Run** — `#ff6b35` bg, `#0b0e14` text, rounded, 10px uppercase font-semibold. Non-functional placeholder.
- **Export** — transparent bg, `#1e2433` border, `#5a6173` text, rounded, 10px uppercase font-semibold. Non-functional placeholder.

---

## 6. Interaction State

All state is local React `useState`:

| State          | Type                               | Default     | Purpose                                       |
| -------------- | ---------------------------------- | ----------- | --------------------------------------------- |
| `selectedId`   | `string`                           | `"exp_001"` | Currently selected experiment in sidebar      |
| `statusFilter` | `string[]`                         | `[]`        | Active status filter chips (empty = show all) |
| `tab`          | `"config" \| "runs" \| "evidence"` | `"config"`  | Active tab in detail panel                    |

**Behaviors:**

- Clicking a sidebar item sets `selectedId`, which updates the entire right panel.
- Clicking a filter chip toggles it in `statusFilter`. The sidebar list filters to matching experiments.
- Clicking a tab switches the detail panel content.
- Tab counts are live — they reflect the selected experiment's actual run/evidence counts.
- The status bar footer shows `{filtered.length} of {total} shown`.

---

## 7. Data Shape

Source: `@/lib/mock-data`. Types defined in `lib/mock-data.ts`.

**MockExperiment** fields: `id`, `tag`, `concept`, `taskType` (ecc/control/benchmark), `status` (pending/running/paused/complete/canceled), `rubricModel` (ModelId), `scoringModel` (ModelId), `scaleSize` (3/4/5), `evidenceView` (l0_raw/l1_cleaned/l2_neutralized/l3_abstracted), `scoringMethod`, `promptOrdering`, `abstainEnabled`, `randomizations[]`, `window` (concept/country/startDate/endDate), `runs[]`, `createdAt`.

**MockRun** fields: `id`, `status`, `progress` (0–100), `totalSamples`, `completedSamples`, `startedAt`, `completedAt?`, `stages[]` (name/status/progress).

**MockEvidence** fields: `id`, `experimentId`, `concept`, `view`, `title`, `sourceUrl`, `snippet`, `collectedAt`.

Helper maps: `STATUS_COLORS`, `TASK_TYPE_LABELS`, `VIEW_LABELS`.

---

## 8. Spacing & Sizing Reference

| Element                           | Value                                                                |
| --------------------------------- | -------------------------------------------------------------------- |
| Top bar height                    | 44px (`h-11`)                                                        |
| Status bar height                 | 28px (`h-7`)                                                         |
| Sidebar width                     | 256px (`w-64`)                                                       |
| Sidebar item padding              | `px-3 py-2.5`                                                        |
| Filter section padding            | `px-3 py-3`                                                          |
| Main content padding              | `p-5` (20px)                                                         |
| Tab button padding                | `px-4 py-2`                                                          |
| Table cell padding                | `px-4 py-2.5` (config), `px-4 py-2` (stages), `px-4 py-3` (evidence) |
| Card border-radius                | `rounded` (4px)                                                      |
| StatusDot                         | 8×8px (`h-2 w-2`)                                                    |
| ProgressBar height                | 6px (`h-1.5`)                                                        |
| ProgressBar width (in run header) | 128px (`w-32`)                                                       |
| Config label column               | 192px (`w-48`)                                                       |

---

## 9. Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS 3.4 + inline `style` for hex colors
- **Fonts:** `next/font/google` — Bitter, JetBrains Mono
- **State:** Local `useState` only (no global state, no backend calls in prototype)
- **Data:** Static mock arrays from `lib/mock-data.ts`
- **Components:** All co-located in `app/page.tsx` — `StatusDot`, `ProgressBar`, `ConfigPanel`, `RunsPanel`, `EvidencePanel`

---

## 10. What to Build Next (Future Scope)

These are non-functional placeholders in the prototype that an implementing agent should wire up:

1. **Run button** — should trigger experiment run creation via Convex mutation
2. **Export button** — should generate/download a config bundle (JSON or YAML)
3. **Real data** — replace mock imports with `useQuery(api.lab.listExperiments)` and `useQuery(api.lab.getExperimentStates)`
4. **Evidence fetching** — wire to actual evidence query per selected experiment's window
5. **Real-time updates** — Convex queries are already reactive; runs/stages should live-update
6. **Search/text filter** — add a text input in the sidebar filter section for tag/concept search
7. **Keyboard navigation** — arrow keys to move through sidebar, tab/shift-tab for tabs
8. **Experiment creation** — a "New Experiment" flow (could be a slide-out panel or modal)
9. **Run detail drill-down** — click a run to see individual LLM requests, scores, rubrics
10. **Evidence detail** — click an evidence row to see full content, view level comparisons
