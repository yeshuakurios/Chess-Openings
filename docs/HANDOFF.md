# Handoff

Start a new session by reading `CLAUDE.md`, then this file. Update this file at the end of each session.

## State
- Live: Opening Goals PWA (Vite + TypeScript, Chessground, chess.js, ts-fsrs). Learn, Practice, Drill, back/forward arrows, "why not" messages for wrong captures and checks, offline PWA, progress in IndexedDB.
- Hosting: Cloudflare Worker `chess-openings` (https://chess-openings.yeshuakurios.workers.dev). D1 database `chess-openings` (id in `wrangler.toml`), `SYNC_TOKEN` secret set, optional cross-device sync built. Deploy notes: `docs/deploy-cloudflare.md`.
- Content (draft, unreviewed): Bird's Opening, Portuguese Gambit (Scandinavian 1.e4 d5 2.exd5 Nf6 3.d4 Bg4, assumed meaning), Budapest Gambit in `content/*.json`. Evals are precomputed by `npm run evals`.
- Known issue: the Cloudflare "Workers Builds" check fails instantly on pull-request (non-main) branches. Cause unknown; the same steps (`npm ci`, `npm run build`, `npx wrangler deploy --dry-run`) pass locally from a clean clone. The `main` branch deploys fine. Needs the build log from the Cloudflare dashboard.
- Not yet tested on a real iPhone end to end: follow `docs/pwa-ios-checklist.md`.

## Roadmap (owner's order)
1. Visual goals: show positional and strategy goals on the board (arrows, highlights, pawn shapes).
2. Goals and strategy in high-level, simple language, with no chess notation.
3. Mastery measure: unaided, flawless, on 3 separate days, with FSRS stability above a threshold, plus out-of-order positions and "why" questions. Levels New → Learning → Familiar → Solid → Mastered, per variation.
4. Mistakes tracker (wrong move, hint, slow move, per position), then a root-cause explanation: rule-based first; then optionally Cloudflare Workers AI (free 10,000 neurons/day, no overage on the free plan) rephrasing verified facts only, cached in D1, with a rule-based fallback. Not confirmed: whether signup needs a card; some newer models need a paid method.
5. Gamification: XP, streaks, daily goal, levels, badges.
6. Optimize at $0: position-level scoring, per-opening lazy loading, "new version" notice, accessibility, review caps.

Next up: items 1 + 2.

## Working agreement
- Everything stays $0, no card-on-file services, and it stays a PWA.
- The owner wants ONE short, clear step at a time.
- Work on a branch and open a PR; the owner says when to merge.
- Update this file at turn 20 of every session (count the owner's messages), and say so when doing it.
- Decisions: no push reminders (badge count at most). Workers AI is approved for mistake explanations (Worker-side, free plan, cached in D1, rule-based fallback); reword the "no API at runtime" rule in `CLAUDE.md` when that work starts.
- Never mark content `reviewed`. Check candidate lines with `npm run try`, then `npm run validate`.

## Lessons
- Keep the message card at a fixed height. A taller message shifts the board and Chessground's cached bounds send taps to the wrong squares.
- Don't run `pkill -f <pattern>` with a pattern that also appears in your own command line; it kills the shell.
- Don't name the line's own move in "why not" text; it would give the answer away in Drill.
