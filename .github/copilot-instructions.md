# Copilot instructions

Vite + TypeScript PWA (opening trainer). See `CLAUDE.md` for the stack, commands and rules.

## Coding rules
- Never hardcode secrets or API keys.
- Run `npm run validate` and `npm run build` before proposing changes; content edits also need `npm run evals`.
- Keep changes small and scoped to exactly what the task asks for.
- One branch per task, one focused PR.

## Working notes for the agent
- You can't interact with the running page in this workflow — describe what you changed and what should be checked in the deployed page after merge.
- If a task description is ambiguous or too large, say so in the PR description rather than guessing scope.
