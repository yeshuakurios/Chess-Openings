import type { Card } from 'ts-fsrs';
import type { Attempt } from './store.ts';

export const LEVELS = ['New', 'Learning', 'Familiar', 'Solid', 'Mastered'] as const;
export type Level = typeof LEVELS[number];

/** Placeholder thresholds from the owner-approved definition (docs/HANDOFF.md); tune with real data. */
export const SLOW_MS = 10_000;           // a correct move slower than this is not a clean recall
const SAME_VISIT_MS = 30 * 60 * 1000;    // attempts at one position this close together belong to one visit
export const SOLID_STABILITY = 7;        // FSRS stability in days
export const MASTERED_STABILITY = 21;
export const MASTERED_OOO_SHARE = 0.5;   // share of positions that need a clean out-of-order recall

const dayOf = (t: number) => new Date(t).toLocaleDateString('en-CA'); // local calendar day

export interface PositionState {
  /** Distinct days of clean recall. A slip (wrong move, hint or slow move) takes one off instead of resetting to zero. */
  score: number;
  /** True if at least one clean recall happened when the line was started from the middle. */
  outOfOrder: boolean;
}

/** The positions (move indexes) where the user is to move. */
export const userPositions = (movesLength: number, color: 'white' | 'black') =>
  Array.from({ length: movesLength }, (_, i) => i).filter(i => (i % 2 === 0) === (color === 'white'));

/** Walk one position's attempts in time order, grouped into visits, and score them. */
export function positionState(attempts: Attempt[]): PositionState {
  const sorted = [...attempts].sort((a, b) => a.t - b.t);
  const visits: Attempt[][] = [];
  for (const a of sorted) {
    const cur = visits[visits.length - 1];
    const prev = cur?.[cur.length - 1];
    if (cur && prev && prev.ok === 0 && a.t - prev.t <= SAME_VISIT_MS) cur.push(a); else visits.push([a]);
  }
  let score = 0, outOfOrder = false, lastCleanDay = '';
  for (const v of visits) {
    const last = v[v.length - 1];
    const clean = v.length === 1 && last.ok === 1 && last.h === 0 && last.ms <= SLOW_MS;
    if (clean) {
      const d = dayOf(last.t);
      if (d !== lastCleanDay) { score++; lastCleanDay = d; }
      if (last.o) outOfOrder = true;
    } else score = Math.max(0, score - 1);
  }
  return { score, outOfOrder };
}

export interface LineMastery { level: Level; states: Map<number, PositionState>; hint: string }

const HINTS: Record<Level, string> = {
  New: 'Press Learn to start.',
  Learning: 'Next: play the whole line with no mistakes and no hints.',
  Familiar: 'Next: recall every move cleanly on another day.',
  Solid: 'Next: recall it again after a few weeks, and from the middle of the line.',
  Mastered: 'Mastered. Reviews will keep it fresh.'
};

/**
 * Level of one line. A line is only as strong as its weakest position (the minimum, not the average).
 * The "why" question gate from the definition is not built yet, so Mastered currently needs numbers plus out-of-order recall only.
 */
export function lineMastery(lineKey: string, color: 'white' | 'black', movesLength: number, attempts: Attempt[], card?: Card): LineMastery {
  const mine = attempts.filter(a => a.k === lineKey);
  const positions = userPositions(movesLength, color);
  const states = new Map<number, PositionState>();
  for (const p of positions) states.set(p, positionState(mine.filter(a => a.p === p)));
  let level: Level;
  if (!mine.length && !card?.reps) level = 'New';
  else {
    const min = Math.min(...[...states.values()].map(s => s.score));
    const stability = card?.stability ?? 0;
    const ooo = [...states.values()].filter(s => s.outOfOrder).length / Math.max(1, positions.length);
    if (min >= 3 && stability >= MASTERED_STABILITY && ooo >= MASTERED_OOO_SHARE) level = 'Mastered';
    else if (min >= 2 && stability >= SOLID_STABILITY) level = 'Solid';
    else if (min >= 1) level = 'Familiar';
    else level = 'Learning';
  }
  return { level, states, hint: HINTS[level] };
}

/** Pick a user position to start a spot check from: prefer ones never recalled cleanly from the middle, never the first move. */
export function pickSpotCheck(m: LineMastery, rnd = Math.random): number | undefined {
  const all = [...m.states.keys()].filter(p => p > 0);
  if (!all.length) return undefined;
  const fresh = all.filter(p => !m.states.get(p)!.outOfOrder);
  const pool = fresh.length ? fresh : all;
  return pool[Math.floor(rnd() * pool.length)];
}

/** True if this line already had an out-of-order attempt today. */
export const hadSpotCheckToday = (lineKey: string, attempts: Attempt[], now = Date.now()) =>
  attempts.some(a => a.k === lineKey && a.o && dayOf(a.t) === dayOf(now));
