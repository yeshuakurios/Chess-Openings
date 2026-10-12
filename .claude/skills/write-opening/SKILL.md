---
name: write-opening
description: Draft or extend an opening in content/ (goal, strategy, lines, notes, evals) and verify it. Use when adding an opening or variation.
---
1. Read `src/types.ts` and one existing file in `content/` for the shape.
2. Write the opening's `goal` (title, plain-language text, 3-5 plans) once, then each variation's `strategy` (2-4 sentences: what the plans are in THIS variation) and its `moves` (short, true, one-sentence `note` per ply; 8-16 plies).
3. Check candidate lines with `npm run try -- "<moves>"`. Reject lines where the user's side drops below about -1.0 for a White repertoire or the side being trained is worse than about -1.0.
4. Add common mistakes: for each decision point where a natural wrong move loses material or time, add `mistakes` on the user's move (`{san, line, text}`: the wrong move, 1-6 plies of engine-best punishment, a text of at most 260 characters). Find candidates with `npm run probe -- <opening> <variation>`, check each with `npm run pv -- "<moves up to and including the wrong move>"`. The text says what went wrong and why, and never names the line's own move. Where another line reaches a near-identical position but plays a different move, add `versus` (`{line, text}`) explaining the difference.
5. `npm run validate`, then `npm run evals`, then `npm run validate -- --require-evals`.
6. Set `status: "draft"`. List anything you are unsure of in your final message so a human can check it.
