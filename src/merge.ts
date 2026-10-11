import type { Card } from 'ts-fsrs';
import type { Progress } from './store.ts';

const reviewedAt = (c?: Card) => (c?.last_review ? +new Date(c.last_review) : 0);

/** Union of learned lines, per-card the most recently reviewed wins, best combo is the max. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const cards: Progress['cards'] = {};
  for (const k of new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])) {
    const x = a.cards[k], y = b.cards[k];
    cards[k] = !x ? y : !y ? x : reviewedAt(y) > reviewedAt(x) ? y : x;
  }
  return { learned: { ...a.learned, ...b.learned }, cards, bestCombo: Math.max(a.bestCombo, b.bestCombo) };
}
