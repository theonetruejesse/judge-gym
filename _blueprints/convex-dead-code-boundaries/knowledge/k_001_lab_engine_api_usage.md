# Lab ↔ Engine Convex API Usage

**Confidence:** 0.72

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/src/index.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/page.tsx
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/experiment/[id]/page.tsx
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/evidence/[id]/page.tsx
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/editor/window/_hooks/window-form-hook.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/editor/experiment/_hooks/experiment-form-hook.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab/app/editor/experiment/_components/experiment-editor.tsx

**Summary:**
The Lab frontend consumes Convex endpoints exclusively via the generated `api` re-exported from `@judge-gym/engine` (`packages/engine/src/index.ts`). Usage sites in Lab show it calls a specific subset of `api.packages.lab.*` endpoints: `startExperimentRun`, `listExperiments`, `listEvidenceWindows`, `listEvidenceByWindow`, `getEvidenceContent`, `initExperiment`, `createWindowForm`, `getExperimentSummary`, `listExperimentEvidence`, and `getRunSummary`. This establishes the current Lab ↔ Engine boundary as the Lab package calling only the `packages/lab` Convex surface, not other Convex modules directly.
