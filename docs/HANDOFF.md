# Handoff

Start a new session by reading `CLAUDE.md`, then this file. Update this file at the end of each session.

## State
- Live: Opening Goals PWA (Vite + TypeScript, Chessground, chess.js, ts-fsrs). Learn, Practice, Drill, back/forward arrows, "why not" messages for wrong captures and checks, offline PWA, progress in IndexedDB.
- Hosting: Cloudflare Worker `chess-openings` (https://chess-openings.yeshuakurios.workers.dev). D1 database `chess-openings` (id in `wrangler.toml`), `SYNC_TOKEN` secret set, optional cross-device sync built. Deploy notes: `docs/deploy-cloudflare.md`.
- Content (draft, unreviewed): Bird's Opening, Portuguese Gambit (Scandinavian 1.e4 d5 2.exd5 Nf6 3.d4 Bg4, assumed meaning), Budapest Gambit in `content/*.json`. Evals are precomputed by `npm run evals`.
- Known issue: the Cloudflare "Workers Builds" check fails instantly on pull-request (non-main) branches. Cause unknown; the same steps (`npm ci`, `npm run build`, `npx wrangler deploy --dry-run`) pass locally from a clean clone. The `main` branch deploys fine. Needs the build log from the Cloudflare dashboard.
- Not yet tested on a real iPhone end to end: follow `docs/pwa-ios-checklist.md`.

## Roadmap (agreed; Phase 0 and Phase 1 are built, see the progress notes below)
**Phase 0, foundations:** per-position attempt log (correct/wrong, hint, time, date, variation); schema fields for board `shapes` and plain-language goal/strategy; per-opening content files loaded on demand; `storage.persist()` plus JSON export/import; CI (validate, test, build) on every PR.
**Phase 1, visual goals + plain language** (owner items 1+2): prove the schema on one opening first, then the rest. No chess notation in goal/strategy text.
**Phase 2, content coverage:** pick about 5-8 main lines per opening from the Lichess explorer (build time only), check each with `npm run try`, add as linear variations (still `draft`). Today each opening has only 2-3 single lines, so this is a real gap.
**Phase 3, mastery levels:** see "Mastery definition" below.
**Phase 4, mistakes tracker:** rule-based classifier first (wrong capture/check, move-order slip, confusion between lines). Then Workers AI called from the Worker only: default `@cf/google/gemma-4-26b-a4b-it` (free plan, about 6 neurons per call), `@cf/nvidia/nemotron-3-120b-a12b` for occasional pattern summaries. Rules supply verified facts; the model only rephrases; cache in D1; rule-based text is the fallback (offline, over the 10,000 neurons/day, or error 3040). Model name is one config value. Label output as AI-generated. Before building, test about 20 real wrong moves in Cloudflare's LLM Playground. Reword the "no API at runtime" rule in `CLAUDE.md` first.
**Phase 5, gamification:** XP, streaks, daily goal, levels, badges, computed from the attempt log. No push reminders (badge count at most).
**Phase 6, polish at $0:** review caps, "new version" notice, accessibility, optional Lichess puzzles per opening.
Parallel, not blocking: the real-iPhone test and the Workers Builds log.

Phase 0 progress: 0.1 per-move attempt log (done: `Progress.attempts`, capped at 1500, merged by id; not yet tried on a real device, check via export). 0.2 `navigator.storage.persist()` requested on load (best effort; iOS may decline, so JSON export stays the real backup). 0.3 CI: `.github/workflows/ci.yml` runs validate (with evals), test and build on every PR (its first run is still unverified; GitHub showed no run on PR #9, so check the next PR). 0.4 schema: `Shape`, `PlanBoard`, `Move.shapes`, `Variation.board`, `Opening.goal.board` in `src/types.ts` (mirrored in `scripts/shared.ts`). Per-opening lazy loading was dropped on purpose: the service worker precaches all content for offline use anyway, so lazy loading would save nothing; revisit only if content grows past about 1 MB.

Phase 1 progress: shapes render in Learn (goal card, strategy card, and per-move arrows while stepping) and on the opening page; goal, strategy and summary text for all three openings rewritten in plain language. `npm run validate` now fails if goal, plans, strategy or summary contain move notation or squares, and checks shape squares, colors, ply ranges and board references. Shapes were checked against the real positions (a script printed the piece under every arrow start) and looked at in screenshots. Variation names still carry notation (4.Bf4, 1...d5) on purpose, as labels for real games. Content is still `draft`.

Next up: Phase 2 (content coverage: more main lines per opening, chosen from Lichess explorer data), then Phase 3 (mastery levels).

## Mastery definition (decided; thresholds are placeholders to tune with real data)
- Mastery is per position; a line is capped by its weakest few positions, not the average.
- Position strength comes from FSRS stability in days: under 3, 3-14, 14-45, over 45 map to the upper levels.
- A correct recall counts only if unaided (no hint) and at a normal speed.
- Each level step needs correct recalls on separate days (3 for Mastered).
- Solid and Mastered also need out-of-order starts and a short "why" question.
- Soft slip (owner decision): a mistake lowers that position's strength through FSRS and flags it. It does not reset the whole line or its day count.
- No decay penalty while away; the level shows what was proven, and reviews come due as normal.
- Research notes: FSRS defines no "mastered" threshold (each app picks one). Chessbook scores mastery from review intervals (about 100 days = full credit). Successive relearning (correct to criterion across spaced sessions) is the supported idea; evidence on interleaving is mixed.

## Working agreement
- Everything stays $0, no card-on-file services, and it stays a PWA.
- The owner wants ONE short, clear step at a time.
- Work on a branch and open a PR. The owner has authorized Claude to merge its own PRs without review (stated in session 2026-10-11); still run the local checks first and report what was merged. The Workers Builds check is red on every non-main branch (known issue), so it is not a merge blocker until the cause is found.
- Update this file at turn 20 of every session (count the owner's messages), and say so when doing it.
- Decisions: no push reminders (badge count at most). Workers AI is approved for mistake explanations (Worker-side, free plan, cached in D1, rule-based fallback); reword the "no API at runtime" rule in `CLAUDE.md` when that work starts.
- Never mark content `reviewed`. Check candidate lines with `npm run try`, then `npm run validate`.

## Lessons
- Keep the message card at a fixed height. A taller message shifts the board and Chessground's cached bounds send taps to the wrong squares.
- Don't run `pkill -f <pattern>` with a pattern that also appears in your own command line; it kills the shell.
- Don't name the line's own move in "why not" text; it would give the answer away in Drill.
