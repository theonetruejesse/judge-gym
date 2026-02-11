# LGTM Protocol Core Definition and Abstract

**Confidence:** 0.95

**Sources:**

- .prompts/lgtm-protocol.md (lines 1-5)
- README.md (lines 1-6, 54-61)

**Summary:**

LGTM stands for "Unified Knowledge Traversal & Implementation Planning Protocol" - a formal methodology for systematically analyzing complex problems and generating implementation plans. Unlike the common software development acronym "Looks Good To Me", this LGTM protocol is a structured research and planning framework that decomposes questions into Areas of Analysis, generates and refines micro-hypotheses, validates them through null challenges, and synthesizes findings into implementation plans.

---

The protocol enforces explicit effects for enhanced rigor and testability, leveraging Free Monad patterns within an effectful monad managed by StateT Worldview M. It mandates that all file system interactions and external tool invocations are represented by explicit pipeline primitives. The system decomposes an originalQuestion into Areas of Analysis (A\*i) and concurrently refines modular micro-hypotheses (h_i) using Fork/Join operations.

The creator describes it as "formally modeling the academic research process for coding: find evidence, identify gaps in research, create and challenge hypotheses, then finally write a paper - your task proposal paper."

