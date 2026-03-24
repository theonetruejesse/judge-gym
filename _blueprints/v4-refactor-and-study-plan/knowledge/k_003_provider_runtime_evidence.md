# Provider Runtime Evidence

**Confidence:** 0.84

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N03/provider_runtime_plan.md
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N06/null_challenges.md
- /Users/jesselee/dev/research/jg/judge-gym/_deep_workflows/v4-refactor-and-study-planning/agents/N07/certainty_inputs.md

**Summary:**
The current runtime conflates provider identity with OpenAI transport semantics. A provider-capability matrix plus transport adapters is the correct architectural direction. The safe wave-1 interpretation is narrower than the broad plan: keep the adapter scaffold, support one non-OpenAI provider through direct execution first, and defer provider-native batching and strong multi-provider headline claims until batch artifact persistence and confound control are solved.
