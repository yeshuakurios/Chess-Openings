import { Chess } from 'chess.js';
import { gradeMove, gradeText, posKey, type GradeTable, type Graded } from './grade.ts';
import { grades } from './gradeData.ts';
import type { Attempt } from './store.ts';
import type { Mistake, Opening } from './types.ts';

/** One finished game as chess.com's public API returns it (only the fields we read). */
export interface RawGame {
  url?: string; pgn?: string; rules?: string; end_time?: number;
  white: { username: string; result: string }; black: { username: string; result: string };
}
/** A move the user played in their own games where their line says something else. Short names: it is synced with progress. */
export interface GameMistake {
  k: string;       // variation key, same as the FSRS card key
  f: string;       // the position before the move (FEN without counters), to look the move up in the engine grades
  p: number;       // index of the line move that was skipped
  s: string;       // the move played instead
  n: number; w: number; d: number; l: number; // games / wins / draws / losses for the user
  line: string[];  // what followed in the latest of those games (opponent reply first)
  t: number;       // epoch ms of the latest game
  u?: string;      // link to the latest game
}
/** What the imports found so far. Each import adds only games newer than `last` (see mergeImports), so nothing is counted twice. */
export interface GameImport {
  user: string; at: number;
  ver?: number;    // 2 once mistakes carry the position (`f`) so they can be graded
  last: number;    // end time (epoch seconds) of the newest game imported; later imports only take games after it
  games: number;   // standard games read for this user
  left: number;    // games in which the user left their line on their own move
  kept: number;    // games in which the user followed the line until the opponent left it or it ended
  mistakes: GameMistake[];
  /** Days (epoch days) on which the owner played the line's move at a position (`ok`) or left the line there (`bad`), keyed `variation#ply`. Feeds mastery. Absent in imports made before this existed. */
  recalls?: Record<string, Recalls>;
}
export interface Recalls { ok: number[]; bad: number[] }

export const IMPORT_VERSION = 2;
export const MAX_GAME_MISTAKES = 150; // about 150 bytes each: far below the Worker's 256 KB sync limit
const FOLLOW_UP = 4;                  // plies shown after the wrong move
const RECALL_DAYS = 60;               // newest days kept per position
const DRAWN = new Set(['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient']);

/** Which side the user had and how it ended for them; undefined when the user is in neither seat or the game is not standard chess. */
function sideOf(g: RawGame, user: string): { color: 'white' | 'black'; res: 'w' | 'd' | 'l' } | undefined {
  if (g.rules && g.rules !== 'chess') return undefined;
  const u = user.toLowerCase();
  const color = g.white.username.toLowerCase() === u ? 'white' : g.black.username.toLowerCase() === u ? 'black' : undefined;
  if (!color) return undefined;
  const r = g[color].result;
  return { color, res: r === 'win' ? 'w' : DRAWN.has(r) ? 'd' : 'l' };
}

const newest = (days: Iterable<number>) => [...new Set(days)].sort((a, b) => a - b).slice(-RECALL_DAYS);

/**
 * Replay each game against the lines of the user's openings. A game is "in the line" while every move matches at least one variation that has
 * the same moves so far. If the user then plays a move no such variation has, that is a deviation, counted against every variation at that spot.
 * It only counts once the user has played a move of the line themselves, so a game in a different opening is not a mistake. No engine involved.
 */
export function analyzeGames(games: RawGame[], user: string, openings: Opening[], now = Date.now(), maxItems = MAX_GAME_MISTAKES): GameImport {
  const found = new Map<string, GameMistake>();
  const last = Math.max(0, ...games.map(g => g.end_time ?? 0));
  const rec = new Map<string, { ok: Set<number>; bad: Set<number> }>();
  const mark = (k: string, p: number, kind: 'ok' | 'bad', day: number) => {
    const r = rec.get(`${k}#${p}`) ?? { ok: new Set<number>(), bad: new Set<number>() };
    r[kind].add(day); rec.set(`${k}#${p}`, r);
  };
  let read = 0, left = 0, kept = 0;
  for (const g of games) {
    const side = sideOf(g, user);
    if (!side || !g.pgn) continue;
    const chess = new Chess();
    try { chess.loadPgn(g.pgn); } catch { continue; }
    const sans = chess.history();
    if (!sans.length) continue;
    read++;
    const fens: string[] = []; // the position before each ply
    const rep = new Chess(); for (const s of sans) { fens.push(posKey(rep.fen())); rep.move(s); }
    const t = (g.end_time ?? 0) * 1000, day = Math.floor((g.end_time ?? 0) / 86400);
    let leftHere = false, keptHere = false;
    for (const o of openings) {
      if (o.color !== side.color) continue;
      let cands = o.variations, own = 0, deviated = false;
      for (let p = 0; p < sans.length; p++) {
        cands = cands.filter(v => v.moves.length > p);
        if (!cands.length) break;
        const mine = (p % 2 === 0) === (side.color === 'white');
        const next = cands.filter(v => v.moves[p].san === sans[p]);
        if (next.length) {
          if (mine) { own++; if (day) for (const v of next) mark(`${o.id}/${v.id}`, p, 'ok', day); }
          cands = next; continue;
        }
        if (mine && own > 0) {
          deviated = true;
          if (day && own >= 2) for (const v of cands) mark(`${o.id}/${v.id}`, p, 'bad', day); // one matching move can be a different opening; two is a real try
          for (const v of cands) {
            const id = `${o.id}/${v.id}#${p}#${sans[p]}`;
            const x = found.get(id) ?? { k: `${o.id}/${v.id}`, f: fens[p], p, s: sans[p], n: 0, w: 0, d: 0, l: 0, line: [], t: -1 };
            x.n++; x[side.res]++;
            if (t >= x.t) { x.t = t; x.line = sans.slice(p + 1, p + 1 + FOLLOW_UP); if (g.url) x.u = g.url; }
            found.set(id, x);
          }
        }
        break;
      }
      if (deviated) leftHere = true; else if (own > 0) keptHere = true; // kept = followed the line until the opponent left it or it ended
    }
    if (leftHere) left++; else if (keptHere) kept++;
  }
  const mistakes = [...found.values()].sort((a, b) => b.n - a.n || b.t - a.t).slice(0, maxItems);
  const recalls: Record<string, Recalls> = {};
  for (const [id, r] of rec) recalls[id] = { ok: newest(r.ok), bad: newest(r.bad) };
  return { user, at: now, ver: IMPORT_VERSION, last, games: read, left, kept, mistakes, recalls };
}

const record = (x: GameMistake) => (x.n === 1 ? `In your game ${x.w ? 'you won' : x.d ? 'it was drawn' : 'you lost'}.` : `Played in ${x.n} of your games: ${x.w} won, ${x.d} drawn, ${x.l} lost.`);

/** What to tell the owner about a move they played in a game. With engine data: the grade, what it cost and the engine's reply. Never names the line's own move. */
export function gameMistakeText(x: GameMistake, g?: Graded): string {
  return g ? `${gradeText(g, x.s)} ${record(x)}` : `You played ${x.s} here in ${x.n === 1 ? 'one of your games' : `${x.n} of your games`} (${x.n === 1 ? (x.w ? 'you won' : x.d ? 'a draw' : 'you lost') : `${x.w} won, ${x.d} drawn, ${x.l} lost`}).`;
}

/** The engine's grade for a game mistake, when its position is in the table. */
export const gradeOf = (x: GameMistake, color: 'white' | 'black', table: GradeTable = grades) => (x.f ? gradeMove(table, x.f, x.s, color) : undefined);

/** The mistakes to play out at one move of a line: the ones from the user's own games when there are any (graded when the engine data covers them), the hand-written ones otherwise. */
export function mistakesAt(imp: GameImport | undefined, k: string, ply: number, hand: Mistake[] | undefined, color?: 'white' | 'black', table: GradeTable = grades): Mistake[] {
  const own = imp?.mistakes.filter(x => x.k === k && x.p === ply);
  return own?.length ? own.map(x => {
    const g = color ? gradeOf(x, color, table) : undefined;
    return { san: x.s, line: g?.reply ? [g.reply] : x.line, text: gameMistakeText(x, g), ...(g ? { mark: g.mark, eval: g.eval } : {}) }; // graded: play out the engine's reply, which the text names; the game's own follow-up is on the review screen
  }) : hand ?? [];
}

/** Add a newer import (only games after `old.last`) to the earlier one: counts add up, the latest game's follow-up wins, the biggest MAX_GAME_MISTAKES stay. */
export function mergeImports(old: GameImport, fresh: GameImport, maxItems = MAX_GAME_MISTAKES): GameImport {
  const id = (x: GameMistake) => `${x.k}#${x.p}#${x.s}`;
  const by = new Map(old.mistakes.map(x => [id(x), { ...x }]));
  for (const x of fresh.mistakes) {
    const o = by.get(id(x));
    if (!o) { by.set(id(x), { ...x }); continue; }
    o.n += x.n; o.w += x.w; o.d += x.d; o.l += x.l;
    if (x.t >= o.t) { o.t = x.t; o.line = x.line; if (x.u) o.u = x.u; }
  }
  return { user: fresh.user, at: fresh.at, last: Math.max(old.last, fresh.last), games: old.games + fresh.games, left: old.left + fresh.left, kept: old.kept + fresh.kept,
    mistakes: [...by.values()].sort((a, b) => b.n - a.n || b.t - a.t).slice(0, maxItems), recalls: mergeRecalls(old.recalls, fresh.recalls) };
}

function mergeRecalls(a: Record<string, Recalls> = {}, b: Record<string, Recalls> = {}): Record<string, Recalls> {
  const out: Record<string, Recalls> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) out[id] = { ok: newest([...(a[id]?.ok ?? []), ...(b[id]?.ok ?? [])]), bad: newest([...(a[id]?.bad ?? []), ...(b[id]?.bad ?? [])]) };
  return out;
}

/** The games as attempts at one line, for mastery: a day with the line's move played is a clean recall, a day with the line left is a slip. They never give XP and are not stored with the attempt log. */
export function gameAttempts(imp: GameImport | undefined, k: string): Attempt[] {
  const out: Attempt[] = [];
  if (!imp?.recalls) return out;
  for (const [id, r] of Object.entries(imp.recalls)) {
    if (!id.startsWith(`${k}#`)) continue;
    const p = Number(id.slice(k.length + 1));
    const at = (d: number) => d * 86_400_000 + 43_200_000; // noon UTC
    for (const d of r.bad) out.push({ id: `g${d}b${id}`, k, p, ok: 0, h: 0, ms: 0, t: at(d) - 1, m: 'g' });
    for (const d of r.ok) out.push({ id: `g${d}o${id}`, k, p, ok: 1, h: 0, ms: 0, t: at(d), m: 'g' });
  }
  return out;
}
