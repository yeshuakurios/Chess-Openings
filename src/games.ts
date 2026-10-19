import { Chess } from 'chess.js';
import type { Mistake, Opening } from './types.ts';

/** One finished game as chess.com's public API returns it (only the fields we read). */
export interface RawGame {
  url?: string; pgn?: string; rules?: string; end_time?: number;
  white: { username: string; result: string }; black: { username: string; result: string };
}
/** A move the user played in their own games where their line says something else. Short names: it is synced with progress. */
export interface GameMistake {
  k: string;       // variation key, same as the FSRS card key
  p: number;       // index of the line move that was skipped
  s: string;       // the move played instead
  n: number; w: number; d: number; l: number; // games / wins / draws / losses for the user
  line: string[];  // what followed in the latest of those games (opponent reply first)
  t: number;       // epoch ms of the latest game
  u?: string;      // link to the latest game
}
/** The result of one import. A new import replaces the old one, so re-importing never double counts. */
export interface GameImport {
  user: string; at: number;
  games: number;   // standard games read for this user
  left: number;    // games in which the user left their line on their own move
  kept: number;    // games in which the user followed the line until the opponent left it or it ended
  mistakes: GameMistake[];
}

export const MAX_GAME_MISTAKES = 150; // about 150 bytes each: far below the Worker's 256 KB sync limit
const FOLLOW_UP = 4;                  // plies shown after the wrong move
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

/**
 * Replay each game against the lines of the user's openings. A game is "in the line" while every move matches at least one variation that has
 * the same moves so far. If the user then plays a move no such variation has, that is a deviation, counted against every variation at that spot.
 * It only counts once the user has played a move of the line themselves, so a game in a different opening is not a mistake. No engine involved.
 */
export function analyzeGames(games: RawGame[], user: string, openings: Opening[], now = Date.now(), maxItems = MAX_GAME_MISTAKES): GameImport {
  const found = new Map<string, GameMistake>();
  let read = 0, left = 0, kept = 0;
  for (const g of games) {
    const side = sideOf(g, user);
    if (!side || !g.pgn) continue;
    const chess = new Chess();
    try { chess.loadPgn(g.pgn); } catch { continue; }
    const sans = chess.history();
    if (!sans.length) continue;
    read++;
    const t = (g.end_time ?? 0) * 1000;
    let leftHere = false, keptHere = false;
    for (const o of openings) {
      if (o.color !== side.color) continue;
      let cands = o.variations, own = 0, deviated = false;
      for (let p = 0; p < sans.length; p++) {
        cands = cands.filter(v => v.moves.length > p);
        if (!cands.length) break;
        const mine = (p % 2 === 0) === (side.color === 'white');
        const next = cands.filter(v => v.moves[p].san === sans[p]);
        if (next.length) { if (mine) own++; cands = next; continue; }
        if (mine && own > 0) {
          deviated = true;
          for (const v of cands) {
            const id = `${o.id}/${v.id}#${p}#${sans[p]}`;
            const x = found.get(id) ?? { k: `${o.id}/${v.id}`, p, s: sans[p], n: 0, w: 0, d: 0, l: 0, line: [], t: -1 };
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
  return { user, at: now, games: read, left, kept, mistakes };
}

/** "You played Nc3 here in 3 of your games (1 won, 0 drawn, 2 lost)." Never names the line's own move. */
export function gameMistakeText(x: GameMistake): string {
  const rec = x.n === 1 ? (x.w ? 'you won' : x.d ? 'a draw' : 'you lost') : `${x.w} won, ${x.d} drawn, ${x.l} lost`;
  return `You played ${x.s} here in ${x.n === 1 ? 'one of your games' : `${x.n} of your games`} (${rec}).`;
}

/** The mistakes to play out at one move of a line: the ones from the user's own games when there are any, the hand-written ones otherwise. */
export function mistakesAt(imp: GameImport | undefined, k: string, ply: number, hand: Mistake[] | undefined): Mistake[] {
  const own = imp?.mistakes.filter(x => x.k === k && x.p === ply);
  return own?.length ? own.map(x => ({ san: x.s, line: x.line, text: gameMistakeText(x) })) : hand ?? [];
}
