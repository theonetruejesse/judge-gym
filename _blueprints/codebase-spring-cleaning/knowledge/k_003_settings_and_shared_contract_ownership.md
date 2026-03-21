# Settings And Shared Contract Ownership

**Confidence:** 0.81

**Sources:**
- [packages/engine-settings/src/index.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-settings/src/index.ts)
- [packages/engine-convex/convex/domain/window/evidence_prompts.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/window/evidence_prompts.ts)
- [packages/engine-temporal/src/window/service.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/window/service.ts)
- [packages/engine-convex/convex/domain/temporal/temporal_client.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/temporal/temporal_client.ts)
- [packages/engine-convex/convex/packages/worker.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/packages/worker.ts)
- [packages/engine-convex/convex/domain/analysis/export.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/domain/analysis/export.ts)
- [packages/engine-convex/convex/settings.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/settings.ts)
- [packages/engine-convex/convex/utils/scheduling.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-convex/convex/utils/scheduling.ts)
- [packages/engine-temporal/src/runtime.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/runtime.ts)
- [packages/engine-temporal/src/quota/runtime.ts](/Users/jesselee/dev/research/jg/judge-gym/packages/engine-temporal/src/quota/runtime.ts)
- https://zod.dev/

**Summary:**
`engine-settings` is currently misnamed relative to its contents. Instead of exporting one settings schema plus small supporting constants, it exports workflow contracts, env-key names, quota dimension types, control-update payloads, and full window prompt strings/builders. The package is acting as a mixed contracts module and prompt module, not a settings package. That is reinforced by the actual runtime: most imports come from `engine-temporal`, while Convex does not consume `engine-settings` directly for its own schemas.

The underlying maintenance issue is duplication. `ProcessSnapshot` exists as a TypeScript interface in `engine-settings` and as separate Zod schemas in the Convex Temporal client and worker API. Stage enums are hardcoded again in analysis-export schemas. Window prompt strings are duplicated between `engine-settings` and Convex `evidence_prompts.ts`. Meanwhile, actual runtime settings are fragmented: Convex still has a legacy `ENGINE_SETTINGS` object that appears mostly dead, while Temporal parses its own runtime and quota config separately. The repo is missing a single “settings schema first, infer types from schema” center of gravity and a separate, smaller shared-contracts surface.
