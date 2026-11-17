---
name: answer-explanation
description: Answer a queued "QUEUE explanation: <opening>/<line>#<ply>" request and return a paste-back block saying exactly which content/*.json entry to add and where. Use when the owner pastes a QUEUE explanation message.
---
The app has no paste box: explanations are static JSON in `content/`. The paste-back goes into a Claude Code session on this repo (or a PR), never into the app UI.

1. Parse `<opening>/<line>#<ply>`, the move, the position FEN and the question. Open only that move in `content/<opening>.json` (grep the line id; do not read the whole file).
2. If the question is "why is X wrong / not X": run `npm run pv -- "<moves up to and including X>"` once for the engine line and eval. Say plainly if X is playable (small eval gap) rather than inventing a refutation.
3. Reply to the owner in the requested format: a first line `EXPLANATION <opening>/<line>#<ply>`, then plain text under 900 characters. Cover what X does, what the line's move does instead, the eval gap, and the main risk.
4. Then output a second block headed `PASTE BACK` containing:
   - `File:` `content/<opening>.json`; `Variation id:`; `Move (ply, san):` the move that carries the entry.
   - `Field:` one of: `mistakes` (a wrong move X: `{"san":"X","line":[engine-best plies],"text":"<=260 chars"}`), `versus` (differs from another line: `{"line":"<other id>","text":"..."}`), `why` (only for captures/checks: `"why":{"X":"..."}`), or a longer `note` (one sentence per ply). Pick the field that matches the question; default for "why not X" is `mistakes`.
   - The exact JSON snippet. Its `text` is at most 260 characters and NEVER names the line's own move (the validator checks; Drill would be given away). Do not write `eval` or `caps`; they are generated.
   - `Then run:` `npm run validate`, then `npm run evals` (alone, so old evals do not shift), then `npm run validate -- --require-evals`.
   - `Keep status "draft"; never mark reviewed.`
5. If the owner then says "apply it" (or pastes the block back into a repo session), make the edit, run those commands, commit on the working branch, and tell them to tap "Clear after hand-off" in Settings if the move was flagged.
