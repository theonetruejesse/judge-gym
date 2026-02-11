# LGTM Protocol Usage and Implementation Context

**Confidence:** 0.85

**Sources:**

- README.md (lines 7-37, 49-51)
- README.md (lines 62-68)

**Summary:**

LGTM protocol is designed as a meta-prompt for use with Cursor AI agents when working on high-complexity tasks. It helps avoid wasting hours finding context for complex prompts by functioning as a "budget deep-researcher with real-time interpretability." The protocol involves adding .prompts/ contents to a project, opening a Cursor agent, and running the protocol with the specific problem description.

---

**Implementation Details:**

- Recommended to use Claude 4 Sonnet or other frontier reasoning models
- Still requires providing problem context when describing actual problems
- Allows real-time observation of research process through generated files
- Supports follow-up research queries within same run folder
- Contains warning about LLM hallucinations potentially compounding errors

**Future Development:**

- Creator wants to integrate into proper CLI agent for better forking functionality
- Goal to enable better memory management
- Concern about null challenges getting biased by generations - limited context might improve red-teaming effectiveness

The protocol evolved from trying to formally model the academic research process for coding, with mathematical foundations inspired by category theory for modeling agentic processes more formally.

