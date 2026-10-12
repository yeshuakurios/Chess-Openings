import { Chess } from 'chess.js';
import { SLOW_MS } from './mastery.ts';
import type { Attempt } from './store.ts';
import type { Opening, Variation } from './types.ts';
import { authoredWhy, whyNot } from './why.ts';

import type { Kind } from './explainShared.ts';
export type { Kind };
export interface Explained { kind: Kind; text: string }

/**
 * Rule-based reason for one troublesome attempt. Only verified facts go in:
 * what was played, which other line it belongs to, where it belongs in this line, and the engine data in `caps`.
 * It never names the line's own move, so nothing here gives the answer away.
 */
export function explain(a: Attempt, o: Opening, v: Variation): Explained {
  if (a.ok === 1) {
    return a.h
      ? { kind: 'hint', text: 'You needed the hint here. Re-read the plan for this line, then try again from memory.' }
      : { kind: 'slow', text: 'You knew it, but slowly. Replay the line a few more times until it comes without thinking.' };
  }
  const played = a.s;
  const line = v.moves[a.p];
  if (!played || !line) return { kind: 'other', text: 'That was not the move in this line.' };
  const sans = v.moves.map(m => m.san);
  // The same move belongs at this point of another line of the same opening (the user is mixing the lines up).
  // Prefer the line that shares the longest opening sequence with this one.
  const common = (w: Variation) => { let n = 0; while (n < a.p && w.moves[n].san === sans[n]) n++; return n; };
  const authored = authoredWhy(o, line, played, v, a.p); // a hand-written reason beats the generic texts below
  if (authored) return { kind: 'tactical', text: authored };
  const sibling = o.variations.filter(w => w.id !== v.id && w.moves.length > a.p && w.moves[a.p].san === played)
    .sort((x, y) => common(y) - common(x))[0];
  if (sibling) return { kind: 'other-line', text: `${played} is the move in the "${sibling.name}" line, but this line goes differently here. Check which reply you are facing.` };
  // The move is correct later in this same line: right idea, wrong moment.
  for (let q = a.p + 2; q < v.moves.length; q += 2) {
    if (sans[q] === played) return { kind: 'move-order', text: `${played} is a good move, but it comes later in this line. Something else has to happen first.` };
  }
  const chess = new Chess();
  sans.slice(0, a.p).forEach(s => chess.move(s));
  let tried;
  try { tried = chess.move(played); } catch { return { kind: 'other', text: `${played} was not the move in this line.` }; }
  if (tried.captured || tried.san.includes('+')) return { kind: 'tactical', text: whyNot(o, line, { san: tried.san, captured: tried.captured }, v, a.p) };
  return { kind: 'other', text: `${played} isn't part of this line. Remember the plan: ${o.goal.title.toLowerCase()}.` };
}

export interface Trouble { k: string; p: number; count: number; hints: number; slow: number; last: Explained; played?: string }

const DAY = 24 * 3600_000;
const isClean = (a: Attempt) => a.ok === 1 && a.h === 0 && a.ms <= SLOW_MS;

/** The positions that currently cost the most, newest trouble first among ties. A position fades out once its last two attempts are clean. */
export function troubleSpots(attempts: Attempt[], find: (k: string) => [Opening, Variation] | undefined, now = Date.now(), windowDays = 30, limit = 5): Trouble[] {
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    if (a.t < now - windowDays * DAY) continue;
    const g = groups.get(`${a.k}#${a.p}`) ?? []; g.push(a); groups.set(`${a.k}#${a.p}`, g);
  }
  const out: (Trouble & { score: number; at: number })[] = [];
  for (const g of groups.values()) {
    g.sort((x, y) => x.t - y.t);
    if (g.length >= 2 && isClean(g[g.length - 1]) && isClean(g[g.length - 2])) continue;
    const bad = g.filter(a => !isClean(a));
    if (!bad.length) continue;
    const found = find(g[0].k); if (!found) continue;
    const wrong = bad.filter(a => a.ok === 0).length, hints = bad.filter(a => a.ok === 1 && a.h === 1).length;
    const slow = bad.filter(a => a.ok === 1 && a.h === 0).length;
    const latest = bad[bad.length - 1];
    out.push({ k: g[0].k, p: g[0].p, count: wrong, hints, slow, last: explain(latest, found[0], found[1]), played: latest.s, score: wrong + hints + slow * 0.5, at: latest.t });
  }
  return out.sort((x, y) => y.score - x.score || y.at - x.at).slice(0, limit).map(({ score: _s, at: _a, ...t }) => t);
}
