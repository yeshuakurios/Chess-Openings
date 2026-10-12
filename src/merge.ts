import type { Card } from 'ts-fsrs';
import type { Attempt, Progress, Question } from './store.ts';

const reviewedAt = (c?: Card) => (c?.last_review ? +new Date(c.last_review) : 0);

/** Newest attempts kept. About 75 bytes each, so this stays well under the Worker's 256 KB sync limit. */
export const MAX_ATTEMPTS = 1500;

/** Questions kept and their length. About 300 bytes at most each, so the sync body stays far below the Worker's 256 KB limit. */
export const MAX_QUESTIONS = 200;
export const MAX_QUESTION_CHARS = 500;
export function mergeQuestions(a: Question[], b: Question[]): Question[] {
  const byId = new Map<string, Question>();
  for (const x of [...a, ...b]) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) => x.t - y.t).slice(-MAX_QUESTIONS);
}

/** Union by id, oldest first, newest MAX_ATTEMPTS kept. */
export function mergeAttempts(a: Attempt[], b: Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const x of [...a, ...b]) byId.set(x.id, x);
  return [...byId.values()].sort((x, y) => x.t - y.t).slice(-MAX_ATTEMPTS);
}

/** Per-key maximum. XP is stored as a per-day total, so merging the same day from two devices never double counts. */
const mergeMax = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};
const mergeEarliest = (a: Record<string, string>, b: Record<string, string>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = out[k] && out[k] < v ? out[k] : v;
  return out;
};

/** Flags are a union; a clear on either device (flagsClearedAt) removes every flag made before it. */
function mergeFlags(a: Progress, b: Progress): Pick<Progress, 'flags' | 'flagsClearedAt'> {
  const cleared = Math.max(a.flagsClearedAt ?? 0, b.flagsClearedAt ?? 0);
  const flags: Record<string, number> = {};
  for (const [k, t] of Object.entries(mergeMax(a.flags ?? {}, b.flags ?? {}))) if (t > cleared) flags[k] = t;
  return { flags, flagsClearedAt: cleared };
}

/** Union of learned lines, per-card the most recently reviewed wins, best combo is the max, attempts are unioned. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const cards: Progress['cards'] = {};
  for (const k of new Set([...Object.keys(a.cards), ...Object.keys(b.cards)])) {
    const x = a.cards[k], y = b.cards[k];
    cards[k] = !x ? y : !y ? x : reviewedAt(y) > reviewedAt(x) ? y : x;
  }
  return { learned: { ...a.learned, ...b.learned }, cards, bestCombo: Math.max(a.bestCombo, b.bestCombo), attempts: mergeAttempts(a.attempts, b.attempts),
    xp: mergeMax(a.xp, b.xp), badges: mergeEarliest(a.badges, b.badges), ...mergeFlags(a, b), questions: mergeQuestions(a.questions ?? [], b.questions ?? []) };
}
