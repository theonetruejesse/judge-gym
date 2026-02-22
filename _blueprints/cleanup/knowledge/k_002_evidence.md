# target_registry is window-specific and hardcodes provider

**Confidence:** 0.71

**Sources:**
- packages/engine/convex/domain/orchestrator/target_registry.ts

**Summary:**
The current target registry only supports the "evidence" target type and instantiates WindowOrchestrator directly to parse keys and build process keys. The requeue handler creates a new job and hardcodes provider "openai" instead of using model-derived provider, which couples requeue logic to window and a specific provider.
