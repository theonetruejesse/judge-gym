# LGTM Protocol Interpreter Implementation Details

**Confidence:** 0.87

**Sources:**

- .prompts/lgtm-protocol.md (lines 785-816)
- .prompts/lgtm-protocol.md (lines 796-801)

**Summary:**

The LGTM protocol interpreter implements foldFree to interpret pipeline primitives within StateT Worldview M context. Each primitive maps to specific operations: GenText calls LLM, Fork enables parallel/sequential execution with state management, UseTool accesses external tools, and file operations handle persistence. The StateT context maintains worldview consistency across complex parallel operations while enabling effect tracking and testability.

---

The interpreter function `interpret :: Pipeline a -> StateT Worldview M a` uses `foldFree interpretPrimitive` to process the Free Monad structure. Key implementation details:

- **State Management**: `get` retrieves current worldview for parallel execution context, ensuring consistent state across Fork operations
- **Parallel Execution**: `evalStateT interpret wv` passes state snapshots to parallel pipelines, while sequential execution flows state through `mapM`
- **Effect Handling**: File operations, tool calls, and LLM interactions are lifted into the effectful monad M
- **Testability**: Explicit primitive interpretation enables testing and reasoning about effects

This implementation demonstrates how the mathematical framework translates into practical computational execution while maintaining the formal properties needed for systematic reasoning.

