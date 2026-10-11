import type { Card } from 'ts-fsrs';
import type { Attempt, Progress } from './store.ts';

const reviewedAt = (c?: Card) => (c?.last_review ? +new Date(c.last_review) : 0);

/** Newest attempts kept. About 75 bytes each, so this stays well under the Worker's 256 KB sync limit. */
export const MAX_ATTEMPTS = 1500;

/** Union by id, oldest first, newest MAX_ATTEMPTS kept. */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const x of [...a, ...b]) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) => x.t - y.t).slice(-MAX_ATTEMPTS);
}

/** Union of learned lines, per-card the most recently reviewed wins, best combo is the max, attempts are unioned. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const cards: Progress['cards'] = {};
  for (const k of new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])) {
    const x = a.cards[k], y = b.cards[k];
    cards[k] = !x ? y : !y ? x : reviewedAt(y) > reviewedAt(x) ? y : x;
  }
  return { learned: { ...a.learned, ...b.learned }, cards, bestCombo: Math.max(a.bestCombo, b.bestCombo), attempts: mergeAttempts(a.attempts, b.attempts) };
}
