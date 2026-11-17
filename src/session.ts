// Pure session bookkeeping for the feedback loop: the in-run combo, what a session earned, and the end-of-session summary.
import { BADGES, DAILY_GOAL, dayKey, levelFor, streaks, totalXp, xpForAttempt } from './gamify.ts';

/** What the owner had when a session started, so the summary can say what changed. */
export interface Snapshot { xp: number; today: number; level: number; badges: string[]; mastered: string[]; cleared: number }
export const snapshot = (xp: Record<string, number>, badges: string[], mastered: string[], cleared: number, today = dayKey()): Snapshot =>
  ({ xp: totalXp(xp), today: xp[today] ?? 0, level: levelFor(totalXp(xp)).n, badges, mastered, cleared });

/** Live tally of one session: moves, correct moves, XP from moves and the run of correct moves in a row. */
export interface Tally { moves: number; right: number; combo: number; best: number; xp: number }
export const newTally = (): Tally => ({ moves: 0, right: 0, combo: 0, best: 0, xp: 0 });
/** A correct move without a hint extends the combo; a hint keeps it (no gain), a wrong move ends it. */
export function tallyMove(t: Tally, a: { ok: 0 | 1; h: 0 | 1 }): Tally {
  const combo = a.ok ? (a.h ? t.combo : t.combo + 1) : 0;
  return { moves: t.moves + 1, right: t.right + a.ok, combo, best: Math.max(t.best, combo), xp: t.xp + xpForAttempt(a) };
}
/** Combo milestones worth a small extra cue (haptic, label). */
export const COMBO_MARKS = [5, 10, 20, 30, 50];
export const isComboMark = (n: number) => COMBO_MARKS.includes(n);

export interface Summary {
  xp: number; accuracy?: number; best: number;
  goal: { today: number; target: number; reachedNow: boolean };
  streak: number;
  level?: string; // new title, when the session crossed one
  badges: string[]; // names of badges earned during the session
  mastered: string[]; // keys of lines that reached Mastered during the session
  cleared: number; // game mistakes cleared during the session
}
/** Compare the start of a session with now. Only gains are reported, never losses (no shame). */
export function summarize(before: Snapshot, after: Snapshot, t: Tally, xpByDay: Record<string, number>, today = dayKey()): Summary {
  const known = new Set(before.badges), was = new Set(before.mastered);
  return {
    xp: Math.max(0, after.xp - before.xp),
    ...(t.moves ? { accuracy: Math.round((t.right / t.moves) * 100) } : {}),
    best: t.best,
    goal: { today: after.today, target: DAILY_GOAL, reachedNow: before.today < DAILY_GOAL && after.today >= DAILY_GOAL },
    streak: streaks(xpByDay, today).current,
    ...(after.level > before.level ? { level: levelFor(after.xp).title } : {}),
    badges: after.badges.filter(id => !known.has(id)).map(id => BADGES.find(b => b.id === id)?.name ?? id),
    mastered: after.mastered.filter(k => !was.has(k)),
    cleared: Math.max(0, after.cleared - before.cleared)
  };
}
/** Is anything in the summary worth a celebration? */
export const hasMilestone = (s: Summary) => !!(s.level || s.badges.length || s.mastered.length || s.cleared || s.goal.reachedNow);

/** Varied praise for a flawless line (a variable reward that costs nothing). `rand` in [0, 1). */
export const PRAISE = ['Flawless.', 'Clean as a whistle.', 'Every move on plan.', 'Textbook.', 'Not a single slip.', 'Smooth.', 'Sharp memory.', 'Like you wrote it.'];
export const praise = (rand: number) => PRAISE[Math.min(PRAISE.length - 1, Math.floor(rand * PRAISE.length))];
