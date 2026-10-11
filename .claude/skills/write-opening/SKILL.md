---
name: write-opening
description: Draft or extend an opening in content/ (goal, strategy, lines, notes, evals) and verify it. Use when adding an opening or variation.
---
1. Read `src/types.ts` and one existing file in `content/` for the shape.
2. Write the opening's `goal` (title, plain-language text, 3-5 plans) once, then each variation's `strategy` (2-4 sentences: what the plans are in THIS variation) and its `moves` (short, true, one-sentence `note` per ply; 8-16 plies).
3. Check candidate lines with `npm run try -- "<moves>"`. Reject lines where the user's side drops below about -1.0 for a White repertoire or the side being trained is worse than about -1.0.
4. `npm run validate`, then `npm run evals`, then `npm run validate -- --require-evals`.
5. Set `status: "draft"`. List anything you are unsure of in your final message so a human can check it.
