---
name: answer-explanation
description: Answer a queued "QUEUE explanation: <opening>/<line>#<ply>" request with a reply the owner pastes straight into the app. Use when the owner pastes a QUEUE explanation message.
---
The app has a paste box: the "Paste explanation" button under More on the same move screen (or the Ask page box for several at once). Each block is saved on the device, shown on that move in Learn/Practice/Drill, and copied to D1 (`explanations` table) every 10 minutes while the app is open (`src/notes.ts`, `src/notestore.ts`). Nothing in `content/` changes.

1. Parse `<opening>/<line>#<ply>`, the move, the FEN and the question. Open only that move in `content/<opening>.json` if you need context.
2. For "why is X wrong": run `npm run pv -- "<moves up to and including X>"` once. If X is playable (small eval gap), say so; do not invent a refutation.
3. Reply in exactly this shape so it pastes as is:
   `EXPLANATION <opening>/<line>#<ply>` on its own line, then plain text of at most 900 characters (the app keeps 1000). No markdown. Do not name the line's own move before the position is known.
4. Several queued items: one block each, in one reply, separated by a blank line.
5. Tell the owner to copy the reply and paste it into the "Paste explanation" button under More on the same move screen (or the Ask page box for several at once). Do not edit `content/` unless asked.
