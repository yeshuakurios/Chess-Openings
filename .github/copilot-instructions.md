# Copilot instructions

A single-file static site (`index.html` only) — no framework, no build step,
no other tooling in this repo.

## Deploy
- No CI or deploy config exists here. Don't run any deploy command; if a task seems to need one, say so in the PR instead of guessing.

## Coding rules
- Keep everything in `index.html` unless a task explicitly asks to split it out.
- Never hardcode secrets or API keys.
- Keep changes small and scoped to exactly what the task asks for.
- One branch per task, one focused PR.

## Working notes for the agent
- You can't interact with the running page in this workflow — describe what you changed and what should be checked in the deployed page after merge.
- If a task description is ambiguous or too large, say so in the PR description rather than guessing scope.
