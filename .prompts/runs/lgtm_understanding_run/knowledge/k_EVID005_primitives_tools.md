# LGTM Protocol Pipeline Primitives and Tools

**Confidence:** 0.88

**Sources:**

- .prompts/lgtm-protocol.md (lines 200-299)
- diagrams/lgtm-diagram.md (lines 72-81)

**Summary:**

LGTM protocol defines explicit pipeline primitives for all operations, including base primitives (GenText, Analyze, Validate, Critique, Fork, Join, Iterate, Plan, AgentStep) and effect primitives (WriteFile, ReadFile, CreateDirectory, UseTool, GetWorldview, LogMessage). External tools are accessed through a master tool map containing WebSearch, CodebaseGrep, FileSearch, and file system operations, all invoked via the UseTool primitive.

---

**Key Primitives:**

- **GenText:** LLM text generation
- **AgentStep:** LLM reasoning/action recommendation (no direct tools)
- **Analyze:** Data analysis and transformation
- **Validate:** Rule-based validation
- **Critique:** Critical evaluation using frameworks
- **Fork/Join:** Parallel/sequential execution and result aggregation
- **Iterate:** Loop construct with conditions
- **Plan:** Meta-planning and optimization

**Available Tools:**

- WebSearch: External web search capability
- CodebaseGrep: Code repository searching
- FileSearch: File system searching
- WriteFile/ReadFile: File operations
- CreateDirectory: Directory creation

All operations maintain explicit effects tracking for enhanced rigor and testability, with state managed through StateT Worldview M.

