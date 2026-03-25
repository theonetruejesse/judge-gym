# Live OpenRouter Surface Snapshot

Captured during R04 from the live `https://openrouter.ai/api/v1/models` registry on 2026-03-25 UTC.

## Headline-Relevant Candidates

- `qwen/qwen3-next-80b-a3b-instruct`
- `qwen/qwen3-next-80b-a3b-thinking`
- `qwen/qwen3.5-35b-a3b`
- `qwen/qwen3.5-122b-a10b`
- `qwen/qwen3.5-397b-a17b`
- `deepseek/deepseek-v3.2`
- `moonshotai/kimi-k2`
- `z-ai/glm-4.5`
- `minimax/minimax-m1`
- `inception/mercury-2`

## Observed Policy-Relevant Notes

- The live surface now includes multiple current Qwen text-family lines rather than only older `qwen3` releases.
- Qwen, DeepSeek, GLM, Kimi, and MiniMax all appear as OpenRouter-routable families.
- A diffusion-style outlier is also present via `inception/mercury-2`.
- Several families expose reasoning-control semantics through OpenRouter, but the paper-audit headline lane should still prefer non-thinking / final-answer modes when fidelity matters.
