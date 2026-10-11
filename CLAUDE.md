# Opening Goals (PWA)
Chess opening trainer: for every variation, teach the positional goal, then the strategy, then drill the line with spaced repetition. Personal app, installed on iPhone via Add to Home Screen.

## Stack
Vite + TypeScript (no UI framework), Chessground (board), chess.js (rules), ts-fsrs (scheduling), vite-plugin-pwa (offline). Progress in IndexedDB, optionally synced to Cloudflare D1 through one Worker (`worker/`, `wrangler.toml`, `docs/deploy-cloudflare.md`).

## Commands
- `npm run dev` / `npm run build` (typecheck + build)
- `npm run validate` checks every move in `content/*.json` is legal and has a note. Run it after any content edit.
- `npm run evals` runs Stockfish (Node, build time only) and writes `eval` onto every move. Run after content changes, then `npm run validate -- --require-evals`.
- `npm test` checks the progress merge logic. `npm run build` also typechecks `worker/`.
- `npm run try -- "d4 Nf6 c4 e5"` prints the engine eval after each move, for checking a candidate line.

## Rules
- Content is static JSON in `content/` (one file per opening). The schema lives in `src/types.ts`. Never call Claude or any API at runtime; no engine ships to the client.
- The user's side has exactly one accepted move per position. Any other legal move shows "<move> isn't part of this line." For captures and checks it adds a reason: a hand-written `why[<san>]` on the move if present, otherwise text built from the generated `caps` (engine's best reply and eval). Never name the line's own move in that text (it would give the answer away in Drill). `caps` is written by `npm run evals`; do not edit it by hand.
- The message card has a fixed height on purpose: a taller message would shift the board and break Chessground's cached tap positions.
- Keep it a PWA on free tiers only. No card-on-file services, no secrets in client code. The sync token is a Worker secret and the user's own copy in IndexedDB; never commit `.dev.vars`.
- Content `status: "draft"` means a human has not reviewed the strategy text. Never mark `reviewed` yourself.
- GPL: Chessground is GPL-3.0, so keep the repo's source open if the site is published.

## More
Content authoring procedure: `.claude/skills/write-opening`. iOS install/offline checklist: `docs/pwa-ios-checklist.md`.
