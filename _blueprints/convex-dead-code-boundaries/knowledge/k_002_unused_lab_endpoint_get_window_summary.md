# Unused Lab Endpoint: getWindowSummary

**Confidence:** 0.7

**Sources:**
- /Users/jesselee/dev/research/jg/judge-gym/packages/engine/convex/packages/lab.ts
- /Users/jesselee/dev/research/jg/judge-gym/packages/lab (rg result showed no uses outside definition)

**Summary:**
`packages/engine/convex/packages/lab.ts` exports `getWindowSummary`, but a repo-wide search only finds the definition in `lab.ts` and no call sites in Lab or other packages. This suggests the endpoint is unused by the current Lab UI and other code paths, making it a candidate for pruning or for replacing current over-fetching patterns if kept.
